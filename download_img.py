import urllib.request
import re
import urllib.parse

req = urllib.request.Request('https://html.duckduckgo.com/html/?q=TT+motor+internal+gears', headers={'User-Agent': 'Mozilla/5.0'})
try:
    html = urllib.request.urlopen(req).read().decode('utf-8')
    m = re.search(r'//external-content\.duckduckgo\.com/iu/\?u=([^"&]+)', html)
    if m:
        url = urllib.parse.unquote(m.group(1))
        print("Downloading", url)
        urllib.request.urlretrieve(url, 'd:/AIcode/萬聖節步行機器人/website/assets/img/tt_motor_inside.jpg')
    else:
        print("Not found")
except Exception as e:
    print(e)
