// 1. PUNE CHEIA TA AICI (între apostrofuri)
const API_KEY = 'AIzaSyCzC15-O6zZdz4Bnz0zbOGW2FE93cnMPX8'; 

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

        try {
            console.log("Trimitem datele către Gemini API:", finalPrompt);
            
            // Facem apelul oficial către serverele Google
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ contents: [{ parts: [{ text: finalPrompt }] }] })
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Eroare de la Google:", data);
                throw new Error(`Eroare ${response.status}`);
            }

            // Extragem textul generat de AI
            const aiText = data.candidates[0].content.parts[0].text;
            console.log("Răspuns AI:", aiText);
            
            // Afișăm răspunsul frumos pe ecran
            responseContainer.innerHTML = `
                <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; color: #2C4A3B; margin-top: 20px; border-left: 5px solid #4CAF50; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    <h3 style="margin-top: 0; color: #1a1a1a;">💡 Recomandarea Expertului:</h3>
                    <p style="font-size: 1.05rem; line-height: 1.5; margin-bottom: 0;">${aiText}</p>
                </div>
            `;
            
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