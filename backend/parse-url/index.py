import json
import urllib.request
import urllib.error
import re
from html.parser import HTMLParser


class MetaParser(HTMLParser):
    """Парсер HTML для извлечения мета-тегов, цены и изображения"""

    def __init__(self):
        super().__init__()
        self.og_image = None
        self.og_title = None
        self.og_price = None
        self.price_candidates = []
        self.in_price_element = False

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)

        if tag == 'meta':
            prop = attrs_dict.get('property', '') or attrs_dict.get('name', '')
            content = attrs_dict.get('content', '')

            if prop in ('og:image', 'twitter:image') and not self.og_image:
                self.og_image = content
            elif prop == 'og:title' and not self.og_title:
                self.og_title = content
            elif 'price' in prop.lower() and content:
                self.og_price = content

        price_classes = ['price', 'cost', 'цена', 'стоимость', 'product-price', 'item-price']
        class_val = attrs_dict.get('class', '') or ''
        itemprop = attrs_dict.get('itemprop', '') or ''

        if any(p in class_val.lower() for p in price_classes) or 'price' in itemprop.lower():
            self.in_price_element = True
        else:
            self.in_price_element = False

    def handle_data(self, data):
        if self.in_price_element:
            cleaned = data.strip()
            if cleaned:
                self.price_candidates.append(cleaned)


def extract_price_from_text(text):
    patterns = [
        r'(\d[\d\s]{0,6}[\.,]\d{2})\s*(?:руб|₽|rub|rur|usd|\$|€|EUR)',
        r'(?:руб|₽|rub|rur|usd|\$|€|EUR)\s*(\d[\d\s]{0,6}[\.,]?\d*)',
        r'(\d[\d\s]{1,6})\s*(?:руб|₽)',
        r'(\d{2,6}(?:[.,]\d{2})?)',
    ]
    for pattern in patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        if matches:
            price_str = matches[0].replace(' ', '').replace(',', '.')
            try:
                val = float(price_str)
                if val > 0:
                    return val
            except ValueError:
                continue
    return None


def handler(event: dict, context) -> dict:
    """Парсит URL магазина и возвращает название, изображение и цену товара"""

    cors_headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors_headers, 'body': ''}

    body_raw = event.get('body', '')
    if isinstance(body_raw, dict):
        body = body_raw
    elif isinstance(body_raw, str):
        try:
            body = json.loads(body_raw) if body_raw else {}
        except Exception:
            body = {}
    else:
        body = {}

    url = (body.get('url', '') or '').strip()
    if not url:
        return {'statusCode': 400, 'headers': {**cors_headers, 'Content-Type': 'application/json'}, 'body': json.dumps({'error': 'URL is required'})}

    if not url.startswith('http'):
        url = 'https://' + url

    try:
        req = urllib.request.Request(
            url,
            headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
            }
        )
        opener = urllib.request.build_opener(urllib.request.HTTPRedirectHandler)
        with opener.open(req, timeout=10) as response:
            charset = response.headers.get_content_charset() or 'utf-8'
            html = response.read().decode(charset, errors='replace')
    except Exception as e:
        return {'statusCode': 422, 'headers': cors_headers, 'body': json.dumps({'error': f'Cannot fetch URL: {str(e)}'})}

    parser = MetaParser()
    parser.feed(html[:100000])

    price = None
    if parser.og_price:
        price = extract_price_from_text(parser.og_price)

    if price is None:
        for candidate in parser.price_candidates[:20]:
            price = extract_price_from_text(candidate)
            if price:
                break

    if price is None:
        price_matches = re.findall(
            r'(\d{2,6}(?:[.,]\d{2})?)\s*(?:₽|руб\.?)',
            html[:50000],
            re.IGNORECASE
        )
        if price_matches:
            try:
                price = float(price_matches[0].replace(',', '.').replace(' ', ''))
            except Exception:
                pass

    title = parser.og_title
    if not title:
        title_match = re.search(r'<title[^>]*>([^<]+)</title>', html, re.IGNORECASE)
        if title_match:
            title = title_match.group(1).strip()

    result = {
        'title': title or '',
        'image': parser.og_image or '',
        'price': price,
        'url': url,
    }

    return {
        'statusCode': 200,
        'headers': {**cors_headers, 'Content-Type': 'application/json'},
        'body': json.dumps(result, ensure_ascii=False),
    }