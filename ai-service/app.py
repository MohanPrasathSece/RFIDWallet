from flask import Flask, request, jsonify

app = Flask(__name__)

@app.get('/health')
def health():
    return jsonify({ 'status': 'ok' })

@app.post('/recommend')
def recommend():
    data = request.get_json(silent=True) or {}
    user_id = data.get('userId')
    module = data.get('module', 'library')
    # TODO: Use a model. For now, return static recommendations by module.
    recs = {
        'library': ['Clean Code', 'You Don\'t Know JS', 'Design Patterns'],
        'food': ['Veg Sandwich', 'Chicken Wrap', 'Fresh Juice'],
        'store': ['Notebook', 'Pen Set', 'USB Drive']
    }
    return jsonify({ 'userId': user_id, 'module': module, 'recommendations': recs.get(module, []) })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)
