import websocket
import json
import urllib.request
import sys

sys.stdout.reconfigure(encoding='utf-8')

def run():
    data = json.loads(urllib.request.urlopen('http://127.0.0.1:9222/json').read().decode('utf-8'))
    tab = [p for p in data if 'elevenlabs.io' in p.get('url', '')][0]
    ws = websocket.create_connection(tab['webSocketDebuggerUrl'], suppress_origin=True)

    inspect_parent_js = """
    (() => {
        const dialog = Array.from(document.querySelectorAll('[role="dialog"]')).find(d => d.innerText.includes('Create API Key'));
        const span = Array.from(dialog.querySelectorAll('span')).find(s => s.innerText.trim() === 'Text to Speech');
        if (!span) return 'SPAN_NOT_FOUND';
        
        let row = span;
        while (row && !row.querySelectorAll('button').length) {
            row = row.parentElement;
        }
        
        return {
            rowHtml: row.outerHTML,
            buttons: Array.from(row.querySelectorAll('button')).map(b => ({
                text: b.innerText.trim(),
                dataState: b.getAttribute('data-state'),
                ariaChecked: b.getAttribute('aria-checked'),
                role: b.getAttribute('role'),
                className: b.className
            }))
        };
    })()
    """
    ws.send(json.dumps({'id': 1, 'method': 'Runtime.evaluate', 'params': {'expression': inspect_parent_js, 'returnByValue': True}}))
    res = json.loads(ws.recv())
    print(json.dumps(res.get('result', {}).get('result', {}).get('value', {}), indent=2))
    ws.close()

if __name__ == '__main__':
    run()
