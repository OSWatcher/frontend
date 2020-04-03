from pathlib import PurePath
from urllib.parse import unquote

from flask import jsonify, request
from flask_cors import cross_origin
from oswatcher.model import OS

from . import app

GRAPH = app.config['GRAPH']


@app.route('/list_os', methods=['GET'])
@cross_origin()
def list_os():
    os_list = [os.name for os in OS.match(GRAPH)]
    reply = {
        'status': 'success',
        'os_list': os_list
    }
    return jsonify(reply)


@app.route('/list_fs_at', methods=['GET'])
@cross_origin()
def list_fs_at():
    os_name = request.args.get('os_name')
    fs_path = request.args.get('fs_path')
    reply = {'status': 'success'}

    if fs_path is None:
        fs_path = PurePath('/')
    else:
        fs_path = PurePath('/') / unquote(fs_path)

    cypher_query = "MATCH (:OS {{name: '{os_name}'}})-[:OWNS_FILESYSTEM]->(root:GraphInode {{name: '/' }})".format(
        os_name=os_name)
    for part in fs_path.parts[1:]:
        subquery = "-[:HAS_CHILD]->(:GraphInode {{name: '{folder_name}'}})".format(folder_name=part)
        cypher_query += subquery
    cypher_query += "-[:HAS_CHILD]->(child:GraphInode) RETURN child"
    print(cypher_query)
    cursor = GRAPH.run(cypher_query)
    reply['fs_entries'] = [record['child'] for record in cursor]
    return jsonify(reply)
