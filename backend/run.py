#!/usr/bin/env python3

"""
Usage: app.py [options]

Options:
    -h --help                       Display this message
    -d --debug                      Enable debug output
"""

import logging
# local
from app import app
# 3rd
from docopt import docopt


LOG_FORMAT = "%(asctime)s %(levelname)s:%(name)s:%(message)s"

def main():
    args = docopt(__doc__)
    level = logging.INFO
    if args['--debug']:
        level = logging.DEBUG
    logging.basicConfig(level=level, format=LOG_FORMAT)
    app.run(debug=args['--debug'])


if __name__ == "__main__":
    main()
