from pathlib import PurePath
from urllib.parse import unquote

from flask import render_template
from oswatcher.model import OS, InodeType

from . import app

GRAPH = app.config['GRAPH']


@app.route('/')
def home_page():
    os_list = [os.name for os in OS.match(GRAPH)]
    return render_template('home.html', os_list=os_list)


@app.route('/os/<os_name>')
@app.route('/os/<os_name>/')
@app.route('/os/<os_name>/<path:fs_path>')
def os_view(os_name, fs_path=None):
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
    return render_template('os_view.html', os_name=os_name, fs_path=fs_path, cursor=cursor, InodeType=InodeType, PurePath=PurePath, str=str)
