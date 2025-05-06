import sys
from gtts import gTTS
import os

def generate_tts(text, output_file):
    try:
        # Initialize gTTS with the input text
        tts = gTTS(text=text, lang='en', tld='us')  # US English voice
        # Save the audio to the specified output file
        tts.save(output_file)
        print(f"Audio generated successfully: {output_file}")
    except Exception as e:
        print(f"Error generating audio: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python generate_tts.py <text> <output_file>")
        sys.exit(1)
    
    input_text = sys.argv[1]
    output_file = sys.argv[2]
    generate_tts(input_text, output_file)