export async function enviarCodigoEmail(email, codigo) {
    try {
        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
                "accept": "application/json",
                "content-type": "application/json",
                "api-key": process.env.BREVO_API_KEY
            },
            body: JSON.stringify({
                sender: { name: "Civvo", email: "viestudanteslk7@gmail.com" },
                to: [{ email: email }],
                subject: "Seu código de verificação - Civvo",
                htmlContent: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
                        <h2 style="color: #007bff;">Civvo - Confirmação de Identidade</h2>
                        <p>Olá! Você solicitou uma ação de autenticação na plataforma Civvo.</p>
                        <p>Seu código de verificação de 6 dígitos é:</p>
                        <div style="background-color: #f8f9fa; padding: 15px; text-align: center; border-radius: 6px; margin: 20px 0;">
                            <span style="font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 6px;">${codigo}</span>
                        </div>
                        <p>Este código expira em <b>10 minutos</b>.</p>
                        <p style="font-size: 12px; color: #777; margin-top: 30px;">Se você não solicitou isso, por favor, ignore este e-mail.</p>
                    </div>
                `
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Erro retornado pela API da Brevo:", data);
            throw new Error("Falha ao disparar o e-mail de verificação.");
        }

        console.log("E-mail enviado com sucesso via Brevo REST API:", data);
    } catch (error) {
        console.error("Erro detalhado ao enviar e-mail com Brevo:", error);
        throw error;
    }
}