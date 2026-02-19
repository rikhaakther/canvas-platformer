from flask import Flask, send_from_directory, request, jsonify
import json
import os

app = Flask(__name__, static_folder='.', template_folder='.')

SCORES_FILE = 'scores.json'
MAX_SCORES = 10


def load_scores():
  if not os.path.exists(SCORES_FILE):
    return []
  try:
    with open(SCORES_FILE, 'r', encoding='utf-8') as f:
      return json.load(f)
  except Exception:
    return []


def save_scores(scores):
  with open(SCORES_FILE, 'w', encoding='utf-8') as f:
    json.dump(scores, f, indent=2)


@app.route('/')
def index():
  # Serve main HTML
  return send_from_directory('.', 'index.html')


@app.route('/<path:filename>')
def static_files(filename):
  # Serve JS, CSS, images, etc.
  return send_from_directory('.', filename)


# ------- High score API -------

@app.route('/api/highscores', methods=['GET'])
def get_highscores():
  scores = load_scores()
  return jsonify(scores)


@app.route('/api/highscores', methods=['POST'])
def add_highscore():
  data = request.get_json(silent=True) or {}
  name = (data.get('name') or 'Player')[:20]
  score = int(data.get('score') or 0)
  level = int(data.get('level') or 1)

  scores = load_scores()
  scores.append({'name': name, 'score': score, 'level': level})

  # Sort by highest score, then highest level
  scores.sort(key=lambda s: (-s['score'], -s['level']))
  scores = scores[:MAX_SCORES]

  save_scores(scores)
  return jsonify({'status': 'ok', 'scores': scores})


if __name__ == '__main__':
  app.run(debug=True, port=8000)