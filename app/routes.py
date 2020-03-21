from flask import render_template

from . import app


@app.route('/')
def home_page():
    return render_template('home.html')
