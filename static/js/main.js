// Efeito de digitação (Typewriter)
const text =  "O CI/CD está rodando perfeitamente e seguro com HTTPS.";
const typewriterElement = document.getElementById('typewriter');
let i = 0;

function typeWriter() {
  if (i < text.length) {
    typewriterElement.innerHTML += text.charAt(i);
    i++;
    setTimeout(typeWriter, 50); // Velocidade de digitação (50ms por caractere)
  }
}

typeWriter();//Inicia o efeito quando a página é carregada
window.onload = typeWriter;

//Botão interativo
document.getElementById('action-btn').addEventListener('click', () => {
    alert("Conexão estabelecida com sucesso! Seu pipeline CI/CD está funcionando perfeitamente.");
});