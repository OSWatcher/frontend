import logging
from pathlib import PurePath
from urllib.parse import unquote

from flask import jsonify
from flask_cors import cross_origin

from oswatcher.model import OS

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
