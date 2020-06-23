from pathlib import Path

from flask import Flask
from flask_bootstrap import Bootstrap
from neo4j import GraphDatabase

APP_DIR = Path(__file__).parent.parent

# Define the WSGI application object
app = Flask(__name__)

# Apply Bootstrap
Bootstrap(app)

# Load configuration
app.config.from_pyfile(APP_DIR / 'config.cfg')

# init neo4j driver
driver = GraphDatabase.driver(uri=app.config['NEO4J_URI'],
                              auth=(app.config['NEO4J_USER'], app.config['NEO4J_PASS']))
session = driver.session()
# make driver object available
app.config['driver'] = driver

# define routes
from . import routes    # noqa: E402,F401
