# Spotify player · Vanilla JS + MongoDB Atlas

Catálogo, búsqueda y likes. Colección `spotify.tracks`.

```bash
export GCP_PROJECT_ID=project-778283d9-dc7e-4c2c-947
export MONGODB_URI="mongodb+srv://dani:dany2233@cluster0.rqkadaa.mongodb.net/spotify?retryWrites=true&w=majority&authSource=admin&appName=Cluster0"

gcloud run deploy spotify-player-vanilla \
  --project $GCP_PROJECT_ID \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --update-env-vars="MONGODB_URI=${MONGODB_URI},MONGODB_DB=spotify,MONGODB_COLLECTION=tracks"
```
