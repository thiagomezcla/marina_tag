function renderAuthPage(mode) {
  const isSignUp = mode === "sign-up";
  const title = isSignUp ? "Criar conta - Marina Tag" : "Login - Marina Tag";
  const subtitle = isSignUp
    ? "Crie sua conta para acessar o painel"
    : "Acesse o painel administrativo";
  const componentName = isSignUp ? "mountSignUp" : "mountSignIn";

  if (!CLERK_PUBLISHABLE_KEY) {
    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Clerk não configurado</title>
      </head>
      <body style="font-family:Arial;padding:24px;">
        <h1>Clerk não configurado</h1>
        <p>A variável <strong>CLERK_PUBLISHABLE_KEY</strong> não foi encontrada no Render.</p>
      </body>
      </html>
    `;
  }

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${title}</title>

      <style>
        body {
          margin: 0;
          font-family: Arial, sans-serif;
          background: linear-gradient(135deg, #0f172a, #0369a1);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }

        .page {
          width: 100%;
          max-width: 460px;
        }

        .brand {
          text-align: center;
          color: white;
          margin-bottom: 24px;
        }

        .brand h1 {
          margin-bottom: 8px;
          font-size: 34px;
        }

        .brand p {
          color: #dbeafe;
          font-size: 16px;
        }

        .loading,
        .error {
          background: white;
          color: #0f172a;
          padding: 18px;
          border-radius: 12px;
          text-align: center;
          line-height: 1.5;
        }

        .error {
          color: #991b1b;
        }
      </style>
    </head>

    <body>
      <div class="page">
        <div class="brand">
          <h1>🚤 Marina Tag NFC</h1>
          <p>${subtitle}</p>
        </div>

        <div id="auth-root" class="loading">
          Carregando login...
        </div>
      </div>

      <script>
        const publishableKey = ${JSON.stringify(CLERK_PUBLISHABLE_KEY)};
        const root = document.getElementById("auth-root");

        function showError(message) {
          root.className = "error";
          root.innerHTML =
            "<strong>Erro ao carregar o login.</strong><br><br>" +
            message +
            "<br><br>Confira se a chave pública do Clerk começa com <strong>pk_test_</strong> no Render.";
        }

        function loadScript(src, attrs = {}) {
          return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = src;
            script.async = true;
            script.crossOrigin = "anonymous";

            Object.keys(attrs).forEach((key) => {
              script.setAttribute(key, attrs[key]);
            });

            script.onload = resolve;
            script.onerror = () => reject(new Error("Falha ao carregar: " + src));
            document.head.appendChild(script);
          });
        }

        window.addEventListener("load", async function () {
          try {
            if (!publishableKey || !publishableKey.startsWith("pk_")) {
              throw new Error("CLERK_PUBLISHABLE_KEY inválida ou ausente.");
            }

            const clerkDomain = atob(publishableKey.split("_")[2]).slice(0, -1);

            await loadScript(
              "https://" + clerkDomain + "/npm/@clerk/ui@1/dist/ui.browser.js"
            );

            await loadScript(
              "https://" + clerkDomain + "/npm/@clerk/clerk-js@6/dist/clerk.browser.js",
              {
                "data-clerk-publishable-key": publishableKey
              }
            );

            if (!window.Clerk) {
              throw new Error("ClerkJS não foi carregado.");
            }

            await window.Clerk.load({
              ui: {
                ClerkUI: window.__internal_ClerkUICtor
              }
            });

            root.className = "";
            root.innerHTML = "";

            window.Clerk.${componentName}(root, {
              afterSignInUrl: "/admin/boats",
              afterSignUpUrl: "/admin/boats",
              signInUrl: "/sign-in",
              signUpUrl: "/sign-up"
            });
          } catch (error) {
            console.error(error);
            showError(error.message || "Erro desconhecido.");
          }
        });
      </script>
    </body>
    </html>
  `;
}