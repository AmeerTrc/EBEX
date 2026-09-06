import websocket
import json
import urllib.request
import base64
import sys

def run():
    data = json.loads(urllib.request.urlopen('http://127.0.0.1:9222/json').read().decode('utf-8'))
    tab = [p for p in data if 'elevenlabs.io' in p.get('url', '')][0]
    ws = websocket.create_connection(tab['webSocketDebuggerUrl'], suppress_origin=True)

    ws.send(json.dumps({'id': 1, 'method': 'Page.captureScreenshot', 'params': {'format': 'png'}}))
    res = json.loads(ws.recv())
    b64 = res.get('result', {}).get('data', '')
    if b64:
        with open('c:\\Users\\ameer\\EBEX\\scratch\\elevenlabs_screen.png', 'wb') as f:
            f.write(base64.b64decode(b64))
        print("Screenshot saved successfully!")
    ws.close()

if __name__ == '__main__':
    run()
