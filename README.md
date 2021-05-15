# Overlay service

---

### Production build
```
yarn install --production
```

Tests is not available for production build.


## Run
```bash
NODE_PATH=. NODE_ENV=production node build/src/run --NODE_CONFIG='{"server": {"port": 8080}}'

NODE_PATH=. NODE_ENV=development node build/src/run --NODE_CONFIG='{"server": {"port": 8080}}'
```

---

## API

### Run overlay for the room
```bash
curl -d {} -H "Accept: application/json" -H "Content-Type: application/json" -X POST http://localhost:3000/v1/overlay
```

### Stop overlay for the room
```bash
curl -d {} -H "Accept: application/json" -H "Content-Type: application/json" -X DELETE http://localhost:3000/v1/overlay
```