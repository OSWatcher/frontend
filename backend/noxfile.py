import nox

nox.options.sessions = ["fmt", "lint", "type", "vermin"]


@nox.session
def fmt(session):
    session.install("-r", "dev-requirements.txt")
    # note: black doesn't support setup.cfg
    # so we hardcode the config here
    session.run("black", "--line-length", "120", ".")


@nox.session
def lint(session):
    session.install("-r", "dev-requirements.txt")
    session.run("flake8", "--show-source", "--statistics")
    session.run("isort", "--line-length", "120", ".")


@nox.session
def type(session):
    session.install("-r", "requirements.txt")
    session.install("-r", "dev-requirements.txt")
    session.run("mypy", "-p", "app")


@nox.session
def vermin(session):
    """Check for a maximum Python version"""
    session.install("-r", "dev-requirements.txt")
    # we want to be compatible with PyPy, so 3.7 max
    session.run("vermin", "--no-tips", "--target=3.7-", "app")


@nox.session
def cclean(session):
    """A quick code cleanup without running the unit tests"""
    fmt(session)
    lint(session)
    type(session)
    vermin(session)


@nox.session
def run(session):
    args = session.posargs
    session.install("-r", "requirements.txt")
    session.run("python", "run.py", *args)
