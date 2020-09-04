import logging
from pathlib import PurePath
from pprint import pformat
from typing import Any, Dict, List
from urllib.parse import unquote

from flask import jsonify, request
from flask_cors import cross_origin
from neo4j import Driver, Result
from neo4j.exceptions import DriverError
from py2neo.cypher import cypher_escape

from . import app

DRIVER: Driver = app.config['driver']
DEFAULT_REPLY: Dict[str, Any] = {
    'status': 'failure',
    'error': 0
}
VALID_CRITERIA = ['=', '=~']


def cypher_unescape(value: str):
    return value.strip('`')


@app.route('/os', methods=['GET'])
@cross_origin()
def os():
    reply = DEFAULT_REPLY.copy()
    os_items: List[Dict[str, Any]] = []
    query = '''
    MATCH (o:OS)
    RETURN o
    '''
    try:
        # init empty response
        reply['os'] = os_items
        with DRIVER.session() as session:
            cursor: Result = session.run(query)
            for result in cursor:
                cur_os = result['o']
                os_item = {'id': cur_os['id'],
                           'name': cur_os['name'],
                           'insert_date': cur_os['insert_date'],
                           'type': cur_os['type']}
                os_items.append(os_item)
    except (DriverError, KeyError) as e:
        logging.exception('Cypher error')
        reply['error'] = str(e)
    else:
        reply['os'] = os_items
        reply['status'] = 'success'
    finally:
        return jsonify(reply)


@app.route('/os/<os_id>', methods=['GET'])
@cross_origin()
def os_details(os_id):
    reply = DEFAULT_REPLY.copy()
    query = '''
    MATCH (o:OS)
    WHERE o.id = $os_id
    RETURN o
    '''
    os_item = {}
    try:
        with DRIVER.session() as session:
            cursor: Result = session.run(query, os_id=os_id)
            record = cursor.single()
            cur_os = record['o']
            os_item['id'] = cur_os['id']
            os_item['insert_date'] = cur_os['insert_date']
            os_item['name'] = cur_os['name']
            os_item['type'] = cur_os['type']
    except (DriverError, KeyError) as e:
        logging.exception('Cypher error')
        reply['error'] = str(e)
    else:
        reply['status'] = 'success'
    finally:
        reply['os'] = os_item
        return jsonify(reply)


@app.route('/os/<os_id>/filesystem/', methods=['GET'])
@app.route('/os/<os_id>/filesystem/<path:fs_path>', methods=['GET'])
@cross_origin()
def filesystem(os_id, fs_path=None):
    reply = DEFAULT_REPLY.copy()

    if fs_path is None:
        fs_path = PurePath('/')
    else:
        fs_path = PurePath('/') / unquote(fs_path)
    fs_entries = []
    try:
        with DRIVER.session() as session:
            query_match = 'MATCH (o:OS)'
            query_where: List[str] = ['WHERE o.id = $os_id']
            params = {'os_id': os_id}
            # take parts
            # ['/', 'Program Files', ...]
            fs_path_parts = fs_path.parts
            # add root
            query_match += '-[r_root:OWNS_FILESYSTEM]->(:Tree)'
            query_where.append('AND r_root.name = $r_root')
            params['r_root'] = cypher_escape(fs_path_parts[0])
            # add rest of the paths
            for index, path_part in enumerate(fs_path_parts[1:]):
                rel_var = f'r{index}'
                query_match += f'-[{rel_var}:HAS_CHILD_TREE]->(:Tree)'
                query_where.append(f'AND {rel_var}.name = ${rel_var}')
                params[rel_var] = cypher_escape(path_part)
            # return children
            query_match += '-[rel_child:HAS_CHILD_TREE|HAS_CHILD_BLOB]->(b)\n'
            query = query_match + '\n'.join(query_where) + '\nRETURN rel_child.name as filename, ' \
                                                           'type(rel_child) as child_type, b'
            # run query
            logging.debug('filesystem:query: %s, parameters: %s', pformat(query), pformat(params))
            cursor = session.run(query, parameters=params)
            # entry is like
            # {
            #   'name': 'explorer.exe'
            #   'inode_type': 'DIR'
            # }
            for record in cursor:
                entry = {
                    'name': cypher_unescape(record['filename']),
                    'inode_type': 'FILE'
                }
                if record['child_type'] == 'HAS_CHILD_TREE':
                    entry['inode_type'] = 'DIR'
                else:
                    # add mime_type and file_type
                    entry['mime_type'] = record['b']['mime_type']
                    entry['file_type'] = record['b']['file_type']
                fs_entries.append(entry)
    except DriverError as e:
        logging.exception(e)
        reply['error'] = str(e)
    else:
        reply['status'] = 'success'
    finally:
        reply['fs_entries'] = fs_entries
        return jsonify(reply)


@app.route('/os/<os_id>/filesystem/search', methods=['POST'])
@cross_origin()
def filesystem_search(os_id):
    """
    Filesystem search using criterias provided in the POST request data.
    example of search criteria
    default criteria is =
    [
        {
            "prop": "name",
            "value": "tmp",
            "criteria": "="
        }
    ]

    :param os_id: uuid of OS node
    :return:
    """
    reply = DEFAULT_REPLY.copy()
    filter_list = request.json
    if not filter_list:
        # a search request without a filter would return all the inodes
        # this is not acceptable
        return jsonify(reply)
    logging.debug("filter: %s", filter_list)
    search_result = []
    try:
        with DRIVER.session() as session:
            query = '''
            MATCH (o:OS)
            WHERE o.id = $os_id
            WITH o
            MATCH path = (o)-[r*]->(b:Blob)
            WHERE type(last(r)) = 'HAS_CHILD_BLOB'\n
            '''
            # build where statement
            where_stmt = []
            relationship_properties = ['name', 'setuid', 'setgid', 'sticky']
            params = {'os_id': os_id}
            for index, filt in enumerate(filter_list):
                prop = filt['prop']
                crit = filt.get('criteria', '=')
                # sanitize criteria
                if crit not in VALID_CRITERIA:
                    raise RuntimeError(f'Invalid criteria {crit}')
                val_param_name = f'filter_{index}'
                params[val_param_name] = filt['val']
                if prop in relationship_properties:
                    cur_where = f'AND last(r).{prop} {crit} ${val_param_name}'
                else:
                    cur_where = f'AND b.{prop} {crit} ${val_param_name}'
                where_stmt.append(cur_where)
            query += '\n'.join(where_stmt)
            # add RETURN
            query += '\nRETURN path'
            logging.debug('filesystem:search: %s, %s', pformat(query), pformat(params))
            cursor = session.run(query, parameters=params)
            for result in cursor:
                path_part_list = [cypher_unescape(r['name']) for r in result['path'].relationships]
                bin_path = PurePath('/')
                # skip /
                for part in path_part_list[1:]:
                    bin_path /= part
                item = result['path'].end_node.__dict__['_properties']
                # add 'path' and 'name' keys for checksec table
                item['path'] = str(bin_path)
                item['name'] = bin_path.name
                search_result.append(item)
    except (DriverError, KeyError, RuntimeError) as e:
        logging.exception(e)
        reply['error'] = str(e)
    else:
        reply['status'] = 'success'
    finally:
        reply['result'] = search_result
        return jsonify(reply)


@app.route('/os/<os_id>/syscall', methods=['GET'])
@cross_origin()
def syscall(os_id):
    reply = DEFAULT_REPLY.copy()
    syscall_entries = []
    try:
        with DRIVER.session() as session:
            query = '''
            MATCH (o:OS)-[r:OWNS_SYSCALL]->(syscall:Syscall)
            WHERE o.id = $os_id
            RETURN syscall.name, r.index, r.address
            '''
            cursor = session.run(query, os_id=os_id)
            for result in cursor:
                name, index, address = result
                item = {
                    'name': name,
                    'address': address,
                    'index': index
                }
                syscall_entries.append(item)
    except DriverError as e:
        reply['error'] = str(e)
    else:
        reply['status'] = 'success'
    finally:
        reply['syscall_entries'] = syscall_entries
        return jsonify(reply)
