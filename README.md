# Sign Language Detection System

This project implements a real-time sign language detection system that can recognize hand signs for letters A-Z, with additional features like translation and word suggestions.

## Project Structure

Essential files in this project:

- `inference_classifier.py`: Main application with GUI interface
- `collect_data.py`: Script for collecting training data
- `train_model.py`: Script for training the model
- `model.p`: Trained model file
- `requirements.txt`: List of Python dependencies
- `data/`: Directory containing training data

## Setup Instructions

1. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Collect training data (if needed):
   ```bash
   python collect_data.py
   ```
   - Follow on-screen instructions
   - Press 's' to start collecting each letter
   - Press 'r' to redo current letter
   - Press 'q' to quit

3. Train the model (if needed):
   ```bash
   python train_model.py
   ```

4. Run the application:
   ```bash
   python inference_classifier.py
   ```

## Features

- Real-time hand sign detection for letters A-Z
- Multi-language translation support
- Word suggestions and corrections
- Text-to-speech in multiple languages
- Clear visual feedback
- High accuracy detection

## Usage Instructions

1. Show hand signs clearly in the camera
2. Hold still for 1.5 seconds to confirm a letter
3. Show both hands for space
4. Use the translation dropdown to select target language
5. Click word suggestions to correct words
6. Use speak buttons for audio output

## Supported Languages

- English
- Telugu
- Hindi
- Tamil
- German

## Requirements
- Python 3.8 or higher
- Webcam
- Required Python packages (listed in requirements.txt)

## Installation

1. Clone or download this repository
2. Create a virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install required packages:
```bash
pip install -r requirements.txt
```

## Usage

1. Run the main application:
```bash
python enhanced_sign_language.py
```

2. Using the System:
   - Show hand signs clearly in the camera
   - Hold still for 1.5 seconds until the letter is confirmed
   - Blink to add the letter to the text
   - Show both hands for adding spaces
   - Use the GUI controls to clear text or activate text-to-speech

## Controls
- Clear Text: Clears the current text
- Speak Text: Reads the formed text aloud
- Quit: Closes the application

## Troubleshooting
1. Camera not working:
   - Check if another application is using the camera
   - Ensure camera permissions are enabled

2. Performance issues:
   - Ensure good lighting conditions
   - Keep hands within camera frame
   - Update graphics drivers

## Dependencies
Main packages:
- OpenCV (cv2)
- MediaPipe
- NumPy
- CustomTkinter
- pyttsx3

## License
This project is open-source and available under the MIT License. 