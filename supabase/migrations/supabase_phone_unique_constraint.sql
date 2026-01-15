-- ⚠️ GÜVENLIK: Telefon numarasını unique yaparak fake hesap açılmasını engelle
-- Bu SQL'i Supabase SQL Editor'de çalıştırın

-- 1. Önce mevcut duplicate telefon numaralarını kontrol et
SELECT phone, COUNT(*) as count
FROM public.profiles
WHERE phone IS NOT NULL AND phone != ''
GROUP BY phone
HAVING COUNT(*) > 1;

-- Eğer duplicate'ler varsa önce temizlemeniz gerekiyor:
-- Manuel olarak kontrol edin ve gerçek hesapları belirleyin
-- Fake hesapları silin veya telefonlarını NULL yapın:
-- UPDATE public.profiles SET phone = NULL WHERE id = '<fake-account-id>';

-- 2. Unique constraint ekle (sadece NULL olmayan telefonlar için)
-- PostgreSQL'de partial unique index kullanıyoruz
DROP INDEX IF EXISTS profiles_phone_unique_idx;
CREATE UNIQUE INDEX profiles_phone_unique_idx 
ON public.profiles (phone) 
WHERE phone IS NOT NULL AND phone != '';

-- 3. Opsiyonel: Telefon formatını normalize eden bir trigger ekle
-- Böylece +90541... ve 0541... aynı sayılır
CREATE OR REPLACE FUNCTION normalize_phone_on_insert()
RETURNS TRIGGER AS $$
BEGIN
    -- Boş veya NULL ise dokunma
    IF NEW.phone IS NULL OR NEW.phone = '' THEN
        RETURN NEW;
    END IF;
    
    -- Sadece rakamları al
    NEW.phone := regexp_replace(NEW.phone, '[^0-9]', '', 'g');
    
    -- Türkiye için: başta 0 varsa çıkar
    IF NEW.phone ~ '^0' THEN
        NEW.phone := substring(NEW.phone from 2);
    END IF;
    
    -- Başta 90 yoksa ekle (Türkiye kodu)
    IF NEW.phone !~ '^90' THEN
        NEW.phone := '90' || NEW.phone;
    END IF;
    
    -- Başına + ekle
    NEW.phone := '+' || NEW.phone;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger'ı profiles tablosuna bağla
DROP TRIGGER IF EXISTS normalize_phone_trigger ON public.profiles;
CREATE TRIGGER normalize_phone_trigger
    BEFORE INSERT OR UPDATE OF phone
    ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION normalize_phone_on_insert();

-- 4. Test: Duplicate eklemeyi dene (hata vermeli)
-- INSERT INTO public.profiles (phone, full_name) VALUES ('+905412879705', 'Test User');
-- INSERT INTO public.profiles (phone, full_name) VALUES ('+905412879705', 'Fake User'); -- HATA!
