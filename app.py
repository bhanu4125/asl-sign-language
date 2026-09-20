"""
Production Web Application for Sign Language Detection & Translation.
Serves the responsive web interface and REST API endpoints for model inference.
"""
import os
import sys
import time
import pickle
import logging
import numpy as np
from flask import Flask, render_template, request, jsonify
from deep_translator import GoogleTranslator
from textblob import Word

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
app.config['JSON_SORT_KEYS'] = False

# Model loading
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'model.p')
model = None
model_letters = []

try:
    if os.path.exists(MODEL_PATH):
        with open(MODEL_PATH, 'rb') as f:
            model_dict = pickle.load(f)
            model = model_dict['model']
            model_letters = model_dict.get('letters', [])
        logger.info(f"Model successfully loaded from {MODEL_PATH}")
    else:
        logger.error(f"Model file not found at {MODEL_PATH}")
except Exception as e:
    logger.error(f"Failed to load model: {e}")

# Supported translation languages
SUPPORTED_LANGUAGES = {
    'en': 'English',
    'te': 'Telugu',
    'hi': 'Hindi',
    'ta': 'Tamil',
    'de': 'German',
    'es': 'Spanish',
    'fr': 'French',
    'kn': 'Kannada',
    'ml': 'Malayalam'
}

@app.route('/')
def index():
    """Render the primary sign language assistant UI."""
    return render_template('index.html', languages=SUPPORTED_LANGUAGES)

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint for cloud monitoring."""
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None,
        'timestamp': int(time.time())
    })

@app.route('/predict', methods=['POST'])
def predict():
    """
    Predict sign character from hand landmarks.
    Accepts:
      - 'landmarks': Array of 21 {x, y} coordinate pairs, OR
      - 'features': Array of 42 pre-normalized float values.
    """
    if model is None:
        return jsonify({'error': 'Model not loaded on server'}), 503

    try:
        payload = request.get_json(force=True, silent=True)
        if not payload:
            return jsonify({'error': 'Invalid JSON body'}), 400

        data_aux = []

        if 'features' in payload and len(payload['features']) == 42:
            data_aux = payload['features']
        elif 'landmarks' in payload:
            landmarks = payload['landmarks']
            if len(landmarks) != 21:
                return jsonify({'error': f'Expected 21 landmarks, got {len(landmarks)}'}), 400
            
            x_vals = [float(lm['x']) for lm in landmarks]
            y_vals = [float(lm['y']) for lm in landmarks]
            min_x = min(x_vals)
            min_y = min(y_vals)

            for lm in landmarks:
                data_aux.append(float(lm['x']) - min_x)
                data_aux.append(float(lm['y']) - min_y)
        else:
            return jsonify({'error': 'Missing landmarks or features in request'}), 400

        # Predict
        input_data = np.asarray([data_aux], dtype=np.float32)
        prediction = model.predict(input_data)
        predicted_char = str(prediction[0])

        confidence = 1.0
        if hasattr(model, "predict_proba"):
            try:
                probabilities = model.predict_proba(input_data)[0]
                confidence = float(np.max(probabilities))
            except Exception:
                pass

        return jsonify({
            'letter': predicted_char,
            'confidence': round(confidence, 3)
        })

    except Exception as e:
        logger.error(f"Prediction error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/translate', methods=['POST'])
def translate_text():
    """Translate text to target language with graceful fallback."""
    try:
        data = request.get_json(force=True, silent=True) or {}
        text = data.get('text', '').strip()
        target_lang = data.get('target_lang', 'en')

        if not text:
            return jsonify({'translated_text': ''})

        # If target language is already english, return directly
        if target_lang == 'en':
            return jsonify({
                'original_text': text,
                'target_lang': target_lang,
                'translated_text': text
            })

        translator = GoogleTranslator(source='auto', target=target_lang)
        translated = translator.translate(text)

        return jsonify({
            'original_text': text,
            'target_lang': target_lang,
            'translated_text': translated or text
        })
    except Exception as e:
        logger.warning(f"Translation service notice: {e}")
        # Return original text with a notice rather than 500
        return jsonify({
            'original_text': text,
            'target_lang': target_lang,
            'translated_text': f"{text} (Translation unavailable)",
            'warning': str(e)
        }), 200


@app.route('/suggestions', methods=['POST'])
def word_suggestions():
    """Provide spellcheck and word completion suggestions for the last word."""
    try:
        data = request.get_json(force=True, silent=True) or {}
        word = data.get('word', '').strip().lower()

        if not word or len(word) < 2:
            return jsonify({'suggestions': []})

        candidates = Word(word).spellcheck()
        suggestions = [cand[0] for cand in candidates[:5] if cand[0].lower() != word]

        return jsonify({'word': word, 'suggestions': suggestions})
    except Exception as e:
        logger.error(f"Suggestions error: {e}")
        return jsonify({'suggestions': []})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV', 'development') == 'development'
    logger.info(f"Starting server on http://0.0.0.0:{port} (debug={debug})")
    app.run(host='0.0.0.0', port=port, debug=debug)
