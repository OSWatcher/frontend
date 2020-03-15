from flask import Flask

# Define the WSGI application object
app = Flask(__name__)


@app.route('/')
def home_page():
    return '<h1>Home</h1>'