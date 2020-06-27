#!/usr/bin/env python3

"""
Usage: app.py [options]

Options:
    -h --help                       Display this message
    -d --debug                      Enable debug output
"""

import logging

# 3rd
from docopt import docopt

# local
from app import app

LOG_FORMAT = "%(asctime)s %(levelname)s:%(name)s:%(message)s"


def main():
    args = docopt(__doc__)
    level = logging.INFO
    if args['--debug']:
        level = logging.DEBUG
    logging.basicConfig(level=level, format=LOG_FORMAT)
    # suppress py2neo protocol output
    logging.getLogger("httpstream").setLevel(logging.WARNING)
    logging.getLogger("neo4j").setLevel(logging.WARNING)
    logging.getLogger("neobolt").setLevel(logging.WARNING)
    # run server
    app.run(debug=args['--debug'], ssl_context='adhoc')


if __name__ == "__main__":
    main()
