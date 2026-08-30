from google import genai
from PIL import Image

# API anahtarını otomatik olarak sistem değişkeninden alır
client = genai.Client()

def soru_coz(gorsel_yolu):
    try:
        img = Image.open(gorsel_yolu)
        talimat = (
            "Sen uzman bir öğretmen ve analitsin. Sana gönderilen fotoğraftaki soruyu, "
            "problemi veya bulmacayı dikkatlice incele. Cevabı direkt olarak verme; "
            "önce sorunun mantığını açıkla, çözüm adımlarını sırasıyla göster ve "
            "en son net sonucu mantıksal bir gerekçeyle doldur."
        )

        print("🧠 Yapay zeka fotoğrafı inceliyor ve düşünüyor...")
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[img, talimat]
        )

        print("\n--- ÇÖZÜM RAPORU ---")
        print(response.text)
    except Exception as e:
        print(f"Bir hata oluştu kanka: {e}")

# Test etmek istediğin fotoğrafın adını buraya yazabilirsin (örneğin: soru.png)
soru_coz("soru.png")
