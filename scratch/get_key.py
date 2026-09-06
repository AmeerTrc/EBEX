import websocket
import json
import urllib.request

def run():
    data = json.loads(urllib.request.urlopen('http://127.0.0.1:9222/json').read().decode('utf-8'))
    tab = [p for p in data if 'elevenlabs.io' in p.get('url', '')][0]
    ws = websocket.create_connection(tab['webSocketDebuggerUrl'], suppress_origin=True)

    get_key_js = """
    (() => {
        const input = Array.from(document.querySelectorAll('input')).find(i => i.value && i.value.startsWith('sk_'));
        return input ? input.value : 'NOT_FOUND';
    })()
    """
    ws.send(json.dumps({'id': 1, 'method': 'Runtime.evaluate', 'params': {'expression': get_key_js}}))
    res = json.loads(ws.recv())
    key = res.get('result', {}).get('result', {}).get('value')
    print("EXACT_KEY:", key)
    ws.close()

if __name__ == '__main__':
    run()
