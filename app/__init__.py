from flask import Flask, render_template
from flask_bootstrap import Bootstrap

# Define the WSGI application object
app = Flask(__name__)

# Apply Bootstrap
Bootstrap(app)


@app.route('/')
def home_page():
    return render_template('home.html')
