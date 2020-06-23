import logging
from pathlib import PurePath
from typing import List, Dict, Any
from urllib.parse import unquote

from flask import jsonify, request
from flask_cors import cross_origin
from neo4j import Driver, Result
from neo4j.exceptions import DriverError

from . import app


DRIVER: Driver = app.config['driver']
DEFAULT_REPLY: Dict[str, Any] = {
    'status': 'failure',
    'error': 0
}


@app.route('/os', methods=['GET'])
@cross_origin()
def os():
    reply = DEFAULT_REPLY
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
            os_item = {}
            for result in cursor:
                cur_os = result['o']
                os_item['id'] = cur_os['id']
                os_item['name'] = cur_os['name']
                os_item['insert_date'] = cur_os['insert_date']
                os_item['type'] = cur_os['type']
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
    reply = DEFAULT_REPLY
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


# @app.route('/os/<os_id>/filesystem/', methods=['GET'])
# @app.route('/os/<os_id>/filesystem/<path:fs_path>', methods=['GET'])
# @cross_origin()
# def filesystem(os_id, fs_path=None):
#     reply = {'status': 'success'}
#
#     if fs_path is None:
#         fs_path = PurePath('/')
#     else:
#         fs_path = PurePath('/') / unquote(fs_path)
#
#     cypher_query = "MATCH (:OS {{id: '{os_id}'}})-[:OWNS_FILESYSTEM]->(root:GraphInode {{name: '/' }})".format(
#         os_id=os_id)
#     for part in fs_path.parts[1:]:
#         subquery = "-[:HAS_CHILD]->(:GraphInode {{name: '{folder_name}'}})".format(folder_name=part)
#         cypher_query += subquery
#     cypher_query += "-[:HAS_CHILD]->(child:GraphInode) RETURN child"
#     logging.debug(cypher_query)
#     try:
#         cursor = GRAPH.run(cypher_query)
#     except GraphError:
#         logging.exception("Cypher query failed")
#         return jsonify(reply)
#     reply['fs_entries'] = [record['child'] for record in cursor]
#     return jsonify(reply)
#
#
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
# @app.route('/os/<os_id>/syscall', methods=['GET'])
# @cross_origin()
# def syscall(os_id):
#     reply = {'status': 'success'}
#     cypher_query = "MATCH (:OS {{id: '{os_id}'}})-[:OWNS_SYSCALL]->(syscall:Syscall) RETURN syscall".format(
#         os_id=os_id)
#     logging.debug(cypher_query)
#     try:
#         cursor = GRAPH.run(cypher_query)
#     except GraphError:
#         logging.exception("Cypher query failed")
#         return jsonify(reply)
#     reply['syscall_entries'] = [record['syscall'] for record in cursor]
#     return jsonify(reply)
