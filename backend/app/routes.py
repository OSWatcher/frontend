import logging
from pathlib import PurePath
from typing import List, Dict, Any
from urllib.parse import unquote

from flask import jsonify, request
from flask_cors import cross_origin
from neo4j import Driver, Result
from neo4j.exceptions import DriverError
from py2neo.cypher import cypher_escape
from pprint import pformat

from . import app


DRIVER: Driver = app.config['driver']
DEFAULT_REPLY: Dict[str, Any] = {
    'status': 'failure',
    'error': 0
}


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
            query_match += '-[rel_child:HAS_CHILD_TREE|HAS_CHILD_BLOB]->()\n'
            query = query_match + '\n'.join(query_where) + '\nRETURN rel_child.name as filename, type(rel_child) as child_type'
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
                fs_entries.append(entry)
    except DriverError as e:
        logging.exception(e)
        reply['error'] = str(e)
    else:
        reply['status'] = 'success'
    finally:
        reply['fs_entries'] = fs_entries
        return jsonify(reply)


# @app.route('/os/<os_id>/filesystem/search', methods=['POST'])
# @cross_origin()
# def filesystem_search(os_id):
#     """
#     Filesystem search using criterias provided in the POST request data
#     example of criteria
#     {
#         "setuid": true
#     }
#
#     {
#         "name": "tmp"
#     }
#
#     or even regex
#     {
#         "name": {
#             "type": "regex",
#             "value": ".*tmp.*"
#         }
#     }
#     :param os_id: uuid of OS node
#     :return:
#     """
#     reply = {'status': 'failure'}
#     filter = request.json
#     if not filter:
#         # a search request without a filter would return all the inodes
#         # this is not acceptable
#         return jsonify(reply)
#     logging.debug("filter: %s", filter)
#     where_str_list = []
#     for k, v in filter.items():
#         if isinstance(v, bool):
#             current_filter = f"inode.{k} = {v}"
#         elif isinstance(v, str):
#             current_filter = f"inode.{k} = '{v}'"
#         elif isinstance(v, dict):
#             # complex query
#             try:
#                 type = v['type']
#                 value = v['value']
#             except KeyError:
#                 return jsonify(reply)
#             else:
#                 # redouble backslack because of JSON
#                 value = value.replace('\\', '\\\\')
#                 logging.info(value)
#                 # one type is supported: regex
#                 if type != 'regex':
#                     return jsonify(reply)
#                 current_filter = f"inode.{k} =~ '{value}'"
#         else:
#             return jsonify(reply)
#         where_str_list.append(current_filter)
#     inode_where = ' AND '.join(where_str_list)
#     cypher_query = \
#         f"MATCH (os:OS)-[*]->(inode:GraphInode)\n" \
#         f"WHERE os.id = '{os_id}' AND {inode_where}\n" \
#         "RETURN inode"
#     logging.debug(cypher_query)
#     try:
#         cursor = GRAPH.run(cypher_query)
#     except GraphError:
#         logging.exception("Cypher query failed")
#         return jsonify(reply)
#     graph_inodes_properties = [k for k, v in GraphInode.__dict__.items() if isinstance(v, Property)]
#     search_result = []
#     for record in cursor:
#         current_result = {}
#         for prop in graph_inodes_properties:
#             current_result[prop] = record['inode'][prop]
#         search_result.append(current_result)
#     reply['result'] = search_result
#     reply['status'] = 'success'
#     return jsonify(reply)
#
#
@app.route('/os/<os_id>/syscall', methods=['GET'])
@cross_origin()
def syscall(os_id):
    reply = DEFAULT_REPLY.copy()
    syscall_entries = []
    try:
        with DRIVER.session() as session:
            query = '''
            MATCH (o:OS)-[:OWNS_SYSCALL]->(syscall:Syscall)
            WHERE o.id = $os_id
            RETURN syscall
            '''
            cursor = session.run(query, os_id=os_id)
            for result in cursor:
                cur_syscall = result['syscall']
                item = {
                    'name': cur_syscall['name'],
                    'address': cur_syscall['address'],
                    'index': cur_syscall['index']
                }
                syscall_entries.append(item)
    except DriverError as e:
        reply['error'] = str(e)
    else:
        reply['status'] = 'success'
    finally:
        reply['syscall_entries'] = syscall_entries
        return jsonify(reply)
