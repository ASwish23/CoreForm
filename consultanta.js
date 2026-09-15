// Loaded from config.js (gitignored) — see config.example.js for the template.
// NOTE: this key is still shipped to the browser and callable by anyone who
// views the page source — it needs to move behind a server-side proxy
// (a Supabase Edge Function, like supabase/functions/netopia-payment) before
// this feature goes back live for real traffic.
const API_KEY = window.GEMINI_API_KEY;

document.addEventListener('DOMContentLoaded', () => {
    // Găsim formularul și containerul de răspuns din HTML
    const form = document.querySelector('form');
    const responseContainer = document.getElementById('ai-response-container');

    if (!form) {
        console.error("Nu am găsit formularul în HTML!");
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault(); // Oprim reîncărcarea paginii

        // Găsim butonul pentru a-l dezactiva cât timp AI-ul "gândește"
        const submitButton = form.querySelector('button[type="submit"]') || form.querySelector('button');
        
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.innerText = "🤖 AI-ul analizează detaliile...";
        }

        // Extragem AUTOMAT toate răspunsurile bifate sau scrise de client
        let userDetails = "";
        const allInputs = form.querySelectorAll('input[type="radio"]:checked, select, textarea, input[type="text"]');
        allInputs.forEach(input => {
            if (input.value.trim() !== "") {
                userDetails += `- ${input.value}\n`;
            }
        });

        // Construim "creierul" - instrucțiunile pentru Gemini + datele clientului
        const finalPrompt = `Ești un expert în printare 3D. Analizează nevoile clientului și recomandă DOAR UNUL dintre următoarele materiale: PLA, PETG, ABS/ASA, TPU, Rășină. Răspunde în limba română. Fii prietenos, scurt și explică în 2-3 propoziții de ce ai ales acel material.\n\nDetalii despre dorința clientului:\n${userDetails}`;

        // Prompt vizual pentru Pollinations bazat pe aceleași detalii ale clientului
        const imagePrompt = `A professional 3D printed object concept based on these requirements: ${userDetails}. High quality product photography, clean white background, detailed 3D print texture, studio lighting.`;

        try {
            console.log("Trimitem datele către Gemini API...");

            const textResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: finalPrompt }] }] })
            });

            const textData = await textResponse.json();

            if (!textResponse.ok) {
                console.error("Eroare de la Google (text):", textData);
                throw new Error(`Eroare text ${textResponse.status}`);
            }

            const aiText = textData.candidates[0].content.parts[0].text;
            console.log("Răspuns AI text:", aiText);

            responseContainer.innerHTML = `
                <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; color: #2C4A3B; margin-top: 20px; border-left: 5px solid #4CAF50; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    <h3 style="margin-top: 0; color: #1a1a1a;">💡 Recomandarea Expertului:</h3>
                    <p style="font-size: 1.05rem; line-height: 1.5; margin-bottom: 0;">${aiText}</p>
                </div>
                <div id="image-loading-state" style="text-align: center; padding: 15px; color: #555; font-style: italic; margin-top: 10px;">⏳ Se generează conceptul vizual...</div>
            `;

            const encodedPrompt = encodeURIComponent(imagePrompt);
            const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&nologo=true`;

            const img = document.createElement('img');
            img.alt = "Concept vizual generat de AI";
            img.style.cssText = "width: 100%; max-width: 400px; border-radius: 8px; display: block; margin: 15px auto 0; box-shadow: 0 4px 12px rgba(0,0,0,0.1);";

            img.onload = () => {
                const loadingEl = document.getElementById('image-loading-state');
                if (loadingEl) {
                    loadingEl.replaceWith(img);
                } else {
                    responseContainer.appendChild(img);
                }
                console.log("Imagine Pollinations generată cu succes.");
            };

            img.onerror = () => {
                console.warn("Imaginea Pollinations nu a putut fi încărcată.");
                const loadingEl = document.getElementById('image-loading-state');
                if (loadingEl) loadingEl.remove();
            };

            img.src = pollinationsUrl;

        } catch (error) {
            console.error("🚨 EROARE:", error);
            responseContainer.innerHTML = `<div style="color: #D32F2F; background: #FFEBEE; padding: 15px; border-radius: 8px; margin-top: 20px;">A apărut o eroare de conexiune. Te rugăm să încerci din nou.</div>`;
        } finally {
            // La final, indiferent de rezultat, reactivăm butonul
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.innerText = "Întreabă AI-ul";
            }
        }
    });
});