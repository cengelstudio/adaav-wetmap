# API Dokümantasyonu

Bu dokümantasyon, Flask tabanlı API'nin tüm endpoint'lerini, aldığı request'leri ve verdiği response'ları detaylı olarak açıklar.

## Genel Bilgiler

- **Base URL**: `https://adaav-wetmap-api.glynet.com/api`
- **Authentication**: JWT Token (Authorization header'da `Bearer <token>` formatında)
- **Content-Type**: `application/json`

## Authentication

### Token Gereksinimleri

Çoğu endpoint JWT token gerektirir. Token'ı request header'ında şu şekilde gönderin:
```
Authorization: Bearer <your_jwt_token>
```

## Endpoint'ler

### 1. Root Endpoint

#### `GET /api/`
API'nin çalışıp çalışmadığını kontrol eder.

**Request:**
- Method: `GET`
- URL: `/api/`
- Headers: Gerekli değil

**Response:**
```json
{
  "message": "API is available. See README for endpoints."
}
```

**Status Code:** `200 OK`

---

### 2. Authentication Endpoints

#### `POST /api/auth/login`
Kullanıcı girişi yapar ve JWT token döner.

**Request:**
- Method: `POST`
- URL: `/api/auth/login`
- Headers: `Content-Type: application/json`
- Body:
```json
{
  "username": "string",
  "password": "string"
}
```

**Response (Başarılı):**
```json
{
  "token": "jwt_token_string",
  "user": {
    "id": "string",
    "name": "string",
    "username": "string"
  }
}
```

**Response (Hatalı):**
```json
{
  "message": "Kullanıcı adı veya şifre hatalı!"
}
```

**Status Codes:**
- `200 OK`: Başarılı giriş
- `401 Unauthorized`: Hatalı kullanıcı adı veya şifre

#### `GET /api/auth/me`
Mevcut kullanıcının bilgilerini döner.

**Request:**
- Method: `GET`
- URL: `/api/auth/me`
- Headers: `Authorization: Bearer <token>`

**Response:**
```json
{
  "id": "string",
  "name": "string",
  "username": "string"
}
```

**Status Codes:**
- `200 OK`: Başarılı
- `401 Unauthorized`: Geçersiz veya eksik token

---

### 3. Users Endpoints

#### `GET /api/users/`
Tüm kullanıcıları listeler.

**Request:**
- Method: `GET`
- URL: `/api/users/`
- Headers: `Authorization: Bearer <token>`

**Response:**
```json
{
  "users": [
    {
      "id": "string",
      "name": "string",
      "username": "string",
      "role": "AUTHORIZED_PERSON",
      "isAdmin": true/false
    }
  ]
}
```

**Status Code:** `200 OK`

#### `POST /api/users/`
Yeni kullanıcı oluşturur.

**Request:**
- Method: `POST`
- URL: `/api/users/`
- Headers:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- Body:
```json
{
  "name": "string",
  "username": "string",
  "password": "string",
  "role": "AUTHORIZED_PERSON" // Opsiyonel
}
```

**Response:**
```json
{
  "user": {
    "id": "string",
    "name": "string",
    "username": "string",
    "role": "AUTHORIZED_PERSON",
    "isAdmin": false
  }
}
```

**Status Code:** `200 OK`

#### `GET /api/users/<user_id>`
Belirli bir kullanıcının bilgilerini getirir.

**Request:**
- Method: `GET`
- URL: `/api/users/<user_id>`
- Headers: `Authorization: Bearer <token>`

**Response (Başarılı):**
```json
{
  "user": {
    "id": "string",
    "name": "string",
    "username": "string",
    "role": "AUTHORIZED_PERSON",
    "isAdmin": true/false
  }
}
```

**Response (Hatalı):**
```json
{
  "message": "Kullanıcı bulunamadı!"
}
```

**Status Codes:**
- `200 OK`: Kullanıcı bulundu
- `404 Not Found`: Kullanıcı bulunamadı

#### `PUT /api/users/<user_id>`
Kullanıcı bilgilerini günceller.

**Request:**
- Method: `PUT`
- URL: `/api/users/<user_id>`
- Headers:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- Body (Tüm alanlar opsiyonel):
```json
{
  "name": "string",
  "username": "string",
  "password": "string",
  "role": "string"
}
```

**Response (Başarılı):**
```json
{
  "user": {
    "id": "string",
    "name": "string",
    "username": "string",
    "role": "string",
    "isAdmin": true/false
  }
}
```

**Response (Hatalı):**
```json
{
  "message": "Kullanıcı bulunamadı!"
}
```

**Status Codes:**
- `200 OK`: Kullanıcı güncellendi
- `404 Not Found`: Kullanıcı bulunamadı

#### `DELETE /api/users/<user_id>`
Kullanıcıyı siler.

**Request:**
- Method: `DELETE`
- URL: `/api/users/<user_id>`
- Headers: `Authorization: Bearer <token>`

**Response (Başarılı):**
```json
{
  "success": true,
  "message": "Kullanıcı silindi."
}
```

**Response (Kendi hesabını silmeye çalışma):**
```json
{
  "success": false,
  "message": "Kendi hesabınızı silemezsiniz!"
}
```

**Response (Kullanıcı bulunamadı):**
```json
{
  "success": false,
  "message": "Kullanıcı bulunamadı!"
}
```

**Status Codes:**
- `200 OK`: Kullanıcı silindi
- `403 Forbidden`: Kendi hesabını silmeye çalışma
- `404 Not Found`: Kullanıcı bulunamadı

---

### 4. Locations Endpoints

#### `GET /api/locations/`
Tüm konumları listeler. Query parametreleri ile filtreleme yapabilir.

**Request:**
- Method: `GET`
- URL: `/api/locations/`
- Headers: `Authorization: Bearer <token>`
- Query Parameters (Opsiyonel):
  - `type`: Konum tipi
  - `city`: Şehir adı

**Response:**
```json
[
  {
    "id": "string",
    "title": "string",
    "description": "string",
    "latitude": "number",
    "longitude": "number",
    "type": "string",
    "city": "string"
  }
]
```

**Status Code:** `200 OK`

#### `POST /api/locations/`
Yeni konum ekler.

**Request:**
- Method: `POST`
- URL: `/api/locations/`
- Headers:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- Body:
```json
{
  "title": "string",
  "description": "string",
  "latitude": "number",
  "longitude": "number",
  "type": "string",
  "city": "string"
}
```

**Response:**
```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "latitude": "number",
  "longitude": "number",
  "type": "string",
  "city": "string"
}
```

**Status Code:** `201 Created`

#### `PUT /api/locations/<loc_id>`
Konum bilgilerini günceller.

**Request:**
- Method: `PUT`
- URL: `/api/locations/<loc_id>`
- Headers:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`
- Body (Tüm alanlar opsiyonel):
```json
{
  "title": "string",
  "description": "string",
  "latitude": "number",
  "longitude": "number",
  "type": "string",
  "city": "string"
}
```

**Response (Başarılı):**
```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "latitude": "number",
  "longitude": "number",
  "type": "string",
  "city": "string"
}
```

**Response (Hatalı):**
```json
{
  "message": "Konum bulunamadı!"
}
```

**Status Codes:**
- `200 OK`: Konum güncellendi
- `404 Not Found`: Konum bulunamadı

#### `DELETE /api/locations/<loc_id>`
Konumu siler.

**Request:**
- Method: `DELETE`
- URL: `/api/locations/<loc_id>`
- Headers: `Authorization: Bearer <token>`

**Response (Başarılı):**
```json
{
  "message": "Konum silindi."
}
```

**Response (Hatalı):**
```json
{
  "message": "Konum bulunamadı!"
}
```

**Status Codes:**
- `200 OK`: Konum silindi
- `404 Not Found`: Konum bulunamadı

---

## Hata Kodları

| Kod | Açıklama |
|-----|----------|
| 200 | Başarılı |
| 201 | Oluşturuldu |
| 401 | Yetkisiz erişim (Token eksik/geçersiz) |
| 403 | Yasak (Kendi hesabını silme gibi) |
| 404 | Bulunamadı |

## Örnek Kullanım

### 1. Giriş Yapma
```bash
curl -X POST https://adaav-wetmap-api.glynet.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password"}'
```

### 2. Token ile Kullanıcıları Listeleme
```bash
curl -X GET https://adaav-wetmap-api.glynet.com/api/users/ \
  -H "Authorization: Bearer <your_token>"
```

### 3. Yeni Konum Ekleme
```bash
curl -X POST https://adaav-wetmap-api.glynet.com/api/locations/ \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "İstanbul Havalimanı",
    "description": "Yeni havalimanı",
    "latitude": 41.2622,
    "longitude": 28.7278,
    "type": "airport",
    "city": "İstanbul"
  }'
```

## Notlar

- Tüm endpoint'ler (root hariç) JWT token gerektirir
- Token 12 saat geçerlidir
- Admin kullanıcılar ID'leri 1, 2, 3 olan kullanıcılardır
- Kullanıcılar kendi hesaplarını silemezler
- Konumlar timestamp tabanlı ID'ler alır
