from flask import Flask
from flask_bootstrap import Bootstrap

# Define the WSGI application object
app = Flask(__name__)

# Apply Bootstrap
Bootstrap(app)

# define routes
from . import routes