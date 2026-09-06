import websocket
import json
import urllib.request
import time
import sys

sys.stdout.reconfigure(encoding='utf-8')

def run():
    data = json.loads(urllib.request.urlopen('http://127.0.0.1:9222/json').read().decode('utf-8'))
    tab = [p for p in data if 'elevenlabs.io' in p.get('url', '')][0]
    ws = websocket.create_connection(tab['webSocketDebuggerUrl'], suppress_origin=True)

    # Let's see what is inside the form
    inspect_form_js = """
    (() => {
        const dialog = Array.from(document.querySelectorAll('[role="dialog"]')).find(d => d.innerText.includes('Create API Key'));
        if (!dialog) return { error: 'No dialog' };
        
        // Find form or all inputs/buttons
        const forms = Array.from(dialog.querySelectorAll('form'));
        return {
            hasForm: forms.length > 0,
            innerHtmlSnippet: dialog.innerHTML.substring(0, 1500)
        };
    })()
    """
    ws.send(json.dumps({'id': 1, 'method': 'Runtime.evaluate', 'params': {'expression': inspect_form_js, 'returnByValue': True}}))
    res = json.loads(ws.recv())
    print(res.get('result', {}).get('result', {}).get('value', {}).get('hasForm'))
    ws.close()

if __name__ == '__main__':
    run()
