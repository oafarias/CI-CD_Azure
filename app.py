from flask import Flask

app=Flask(__name__)

@app.route('/')
def hello():
    return "<h1>Hello World!</h1><p>This is a CI/CD pipeline test with Azure DevOps and Docker.</p>"

if __name__ == '__main__':
    app.run(host='0.0.0.0', port = 5000)