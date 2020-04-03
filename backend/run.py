#!/usr/bin/env python3

"""
Usage: app.py [options]

Options:
    -h --help                       Display this message
    -d --debug                      Enable debug output
"""

# local
from app import app
# 3rd
from docopt import docopt


def main():
    args = docopt(__doc__)
    app.run(debug=args['--debug'])


if __name__ == "__main__":
    main()
