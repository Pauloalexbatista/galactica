# Imagem ultraleve Nginx para jogos estáticos HTML5 no Coolify
FROM nginx:alpine

# Copiar os ficheiros do jogo para a pasta pública do Nginx
COPY . /usr/share/nginx/html

# Expor a porta 80 standard do Nginx
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
