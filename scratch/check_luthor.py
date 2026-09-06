import urllib.request
import json
import websocket
import time
import sys

sys.stdout.reconfigure(encoding='utf-8')

def run():
    data = json.loads(urllib.request.urlopen('http://127.0.0.1:9222/json').read().decode('utf-8'))
    tab = [p for p in data if 'elevenlabs.io' in p.get('url', '')][0]
    ws = websocket.create_connection(tab['webSocketDebuggerUrl'], suppress_origin=True)

    click_js = """
    (() => {
        const cards = Array.from(document.querySelectorAll('div, section, article, tr, li'));
        const luthorCard = cards.find(c => c.innerText && c.innerText.includes('Luthor') && c.innerText.length < 500);
        const moreBtn = luthorCard ? luthorCard.querySelector('button[aria-label="More actions"]') : null;
        if (moreBtn) {
            moreBtn.click();
            return 'CLICKED';
        }
        return 'NOT_FOUND';
    })()
    """
    ws.send(json.dumps({'id': 1, 'method': 'Runtime.evaluate', 'params': {'expression': click_js}}))
    print("More btn:", json.loads(ws.recv())['result']['result']['value'])

    time.sleep(1)

    menu_js = """
    (() => {
        const items = Array.from(document.querySelectorAll('[role="menuitem"], [role="option"], button'));
        return items.map(i => ({
            text: i.innerText.trim(),
            role: i.getAttribute('role')
        })).filter(i => i.text);
    })()
    """
    ws.send(json.dumps({'id': 2, 'method': 'Runtime.evaluate', 'params': {'expression': menu_js, 'returnByValue': True}}))
    items = json.loads(ws.recv())['result']['result']['value']
    print("Menu items:\n", json.dumps(items, indent=2))
    ws.close()

if __name__ == '__main__':
    run()
