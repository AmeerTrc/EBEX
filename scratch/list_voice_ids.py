import urllib.request
import json
import websocket
import sys

sys.stdout.reconfigure(encoding='utf-8')

def run():
    data = json.loads(urllib.request.urlopen('http://127.0.0.1:9222/json').read().decode('utf-8'))
    tab = [p for p in data if 'elevenlabs.io' in p.get('url', '')][0]
    ws = websocket.create_connection(tab['webSocketDebuggerUrl'], suppress_origin=True)

    js = """
    (() => {
        const all = Array.from(document.querySelectorAll('[data-testid^="voices-item-"]'));
        return all.map(el => ({
            id: el.getAttribute('data-testid').replace('voices-item-', ''),
            name: el.innerText.split('\\n')[0].trim()
        }));
    })()
    """
    ws.send(json.dumps({'id': 1, 'method': 'Runtime.evaluate', 'params': {'expression': js, 'returnByValue': True}}))
    res = json.loads(ws.recv())
    items = res.get('result', {}).get('result', {}).get('value', [])
    for it in items:
        print(f"{it['name']} => {it['id']}")
    ws.close()

if __name__ == '__main__':
    run()
