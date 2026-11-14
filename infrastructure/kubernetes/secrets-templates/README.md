# Template Secret Kubernetes

File di folder ini hanya **template** berisi nilai contoh (base64 dari teks placeholder).
Jangan isi nilai asli di sini.

Untuk deploy:

```bash
mkdir -p infrastructure/kubernetes/secrets
cp infrastructure/kubernetes/secrets-templates/auth-service-secrets.example.yaml \
   infrastructure/kubernetes/secrets/auth-service-secrets.yaml
# edit nilai di file salinan (base64), lalu:
kubectl apply -f infrastructure/kubernetes/secrets/   # juga dijalankan oleh `make deploy-dev`
```

Folder `infrastructure/kubernetes/secrets/` diabaikan oleh git sehingga secret asli tidak ikut ter-commit.
