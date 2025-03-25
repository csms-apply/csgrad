git pull origin main
npm install
npm run build
sudo npm install -g pm2
pm2 restart docusaurus || pm2 start npm --name "docusaurus" -- run serve
pm2 save