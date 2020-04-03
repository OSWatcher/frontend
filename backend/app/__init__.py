from pathlib import Path

from flask import Flask
from flask_bootstrap import Bootstrap
from py2neo import Graph

APP_DIR = Path(__file__).parent.parent

# Define the WSGI application object
app = Flask(__name__)

# Apply Bootstrap
Bootstrap(app)

# Load configuration
app.config.from_pyfile(APP_DIR / 'config.cfg')

# init neo4j graph object
graph = Graph(password=app.config['DB_PASSWORD'])
# make py2neo graph available for Flask app
app.config['GRAPH'] = graph

# define routes
from . import routes    # noqa: E402,F401
