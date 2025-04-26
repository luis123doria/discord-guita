#  Guardar los cambios en Github
git add .
git commit -m "Cambios..."
git push

# Conectarse al servidor remoto de Amazon Web Services
ssh -i ~/.ssh/guita-bot-keys.pem ubuntu@ec2-3-148-103-235.us-east-2.compute.amazonaws.com

# Navegar hasta el bot
cd discord-guita-v2/discord-guita/

# Traer los cambios
git pull origin main

# Ver status del bot y ejecutar el bot
pm2 restart 0
pm2 status
