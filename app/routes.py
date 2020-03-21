from flask import render_template

from oswatcher.model import OS

from . import app


@app.route('/')
def home_page():
    graph = app.config['GRAPH']
    os_list = [os.name for os in OS.match(graph)]
    return render_template('home.html', os_list=os_list)


@app.route('/os/<os_name>')
def os_view(os_name):
    return render_template('os_view.html', os_name=os_name)
