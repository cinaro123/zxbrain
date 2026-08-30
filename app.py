import streamlit as st
from google import genai
from PIL import Image

# 1. Sayfa Başlığı ve Tasarımı
st.title("🧠 Benim Yapay Zeka Asistanım")
st.write("Fotoğrafı yükle, yapay zeka adım adım mantığını çözüp açıklasın! 😎")

# 2. API İstemcisini Başlatma
client = genai.Client()

# 3. Dosya Yükleme Paneli
yuklenen_dosya = st.file_uploader("Bir soru veya bulmaca fotoğrafı seç...", type=["png", "jpg", "jpeg"])

# 4. Eğer kullanıcı bir fotoğraf yüklediyse çalışacak blok
if yuklenen_dosya is not None:
    img = Image.open(yuklenen_dosya)
    st.image(img, caption="Yüklenen Soru", use_column_width=True)
    
    # 5. Butona basıldığında yapay zekayı tetikleme
    if st.button("Soruyu Analiz Et ve Çöz! 🚀"):
        with st.spinner("Yapay zeka düşünüyor..."):
            try:
                talimat = (
                    "Sen uzman bir öğretmen ve analitsin. Sana gönderilen fotoğraftaki soruyu, "
                    "problemi veya bulmacayı dikkatlice incele. Cevabı direkt olarak verme; "
                    "önce sorunun mantığını açıkla, çözüm adımlarını sırasıyla göster ve "
                    "en son net sonucu mantıksal bir gerekçeyle doldur."
                )

                # Modeli çağırıp görseli ve talimatı gönderiyoruz
                response = client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=[img, talimat]
                )
                
                # Çıktıyı web sitesinde şık bir şekilde gösteriyoruz
                st.success("Çözüm Tamamlandı!")
                st.markdown("### 📌 Çözüm Raporu:")
                st.markdown(response.text)
                
            except Exception as e:
                st.error(f"Bir hata oluştu kanka: {e}")
