# osw-frontend

> Frontend for OSWatcher project

## Requirements

- `Python >= 3.7`
- `NodeJS`

## Setup

Flask API backend

    cd backend
    virtualenv -p python3 venv
    source venv/bin/activate
    (venv) pip install -r requirements.txt
    (venv) pip install /path/to/oswatcher_sources # oswatcher libraries are required, not yet available on pip

VueJS frontend

    cd frontend
    npm install

##  Usage

Backend

    (venv) ./run.py

Frontend

    cd frontend
    npm run serve