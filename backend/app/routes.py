import logging
from pathlib import PurePath
from urllib.parse import unquote

from flask import jsonify, request
from flask_cors import cross_origin
from py2neo.ogm import Property

from oswatcher.model import OS, GraphInode

from . import app

GRAPH = app.config['GRAPH']


@app.route('/os', methods=['GET'])
@cross_origin()
def os():
    reply = {
        'status': 'success',
    }
    os_items = [
        {'id': os.id,
         'name': os.name} for os in OS.match(GRAPH)]
    reply['os'] = os_items
    return jsonify(reply)


@app.route('/os/<os_id>/filesystem/', methods=['GET'])
@app.route('/os/<os_id>/filesystem/<path:fs_path>', methods=['GET'])
@cross_origin()
def filesystem(os_id, fs_path=None):
    reply = {'status': 'success'}

    if fs_path is None:
        fs_path = PurePath('/')
    else:
        fs_path = PurePath('/') / unquote(fs_path)

    cypher_query = "MATCH (:OS {{id: '{os_id}'}})-[:OWNS_FILESYSTEM]->(root:GraphInode {{name: '/' }})".format(
        os_id=os_id)
    for part in fs_path.parts[1:]:
        subquery = "-[:HAS_CHILD]->(:GraphInode {{name: '{folder_name}'}})".format(folder_name=part)
        cypher_query += subquery
    cypher_query += "-[:HAS_CHILD]->(child:GraphInode) RETURN child"
    logging.debug(cypher_query)
    cursor = GRAPH.run(cypher_query)
    reply['fs_entries'] = [record['child'] for record in cursor]
    return jsonify(reply)


@app.route('/os/<os_id>/filesystem/search', methods=['POST'])
def filesystem_search(os_id):
    reply = {'status': 'failure'}
    filter = request.json
    where_str_list = []
    for k, v in filter.items():
        if isinstance(v, bool):
            current_filter = f"_.{k} = {v}"
        elif isinstance(v, str):
            current_filter = f"_.{k} = '{v}'"
        elif isinstance(v, dict):
            # complex query
            try:
                type = v['type']
                value = v['value']
            except KeyError:
                return jsonify(reply)
            else:
                # one type is supported: regex
                if type != 'regex':
                    return jsonify(reply)
                current_filter = f"_.{k} =~ '{value}'"
        else:
            return jsonify(reply)
        where_str_list.append(current_filter)
    where_statement = ' AND '.join(where_str_list)
    logging.debug("WHERE: %s", where_statement)
    match = GraphInode.match(GRAPH).where(where_statement)

    graph_inodes_properties = [k for k, v in GraphInode.__dict__.items() if isinstance(v, Property)]
    search_result = []
    for graph_inode in match:
        current_result = {}
        for prop in graph_inodes_properties:
            current_result[prop] = getattr(graph_inode, prop)
        search_result.append(current_result)
    reply['result'] = search_result
    reply['status'] = 'success'
    return jsonify(reply)


@app.route('/os/<os_id>/syscall', methods=['GET'])
@cross_origin()
def syscall(os_id):
    reply = {'status': 'success'}
    cypher_query = "MATCH (:OS {{id: '{os_id}'}})-[:OWNS_SYSCALL]->(syscall:Syscall) RETURN syscall".format(
        os_id=os_id)
    logging.debug(cypher_query)
    cursor = GRAPH.run(cypher_query)
    reply['syscall_entries'] = [record['syscall'] for record in cursor]
    return jsonify(reply)
