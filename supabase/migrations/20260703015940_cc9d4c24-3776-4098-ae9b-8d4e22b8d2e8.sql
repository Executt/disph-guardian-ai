-- Expandir watchlist NVD com fabricantes, produtos, linguagens, SOs, containers
INSERT INTO public.nvd_watchlist (label, kind, value, category, severity_floor) VALUES
  ('Oracle Database', 'keyword', 'oracle database', 'database', 'high'),
  ('Microsoft SQL Server', 'keyword', 'sql server', 'database', 'high'),
  ('WordPress', 'keyword', 'wordpress', 'cms', 'medium'),
  ('OpenShift / OKD', 'keyword', 'openshift', 'container', 'high'),
  ('Supabase', 'keyword', 'supabase', 'baas', 'medium'),
  ('MongoDB', 'keyword', 'mongodb', 'database', 'high'),
  ('Adobe Acrobat Reader', 'keyword', 'adobe acrobat reader', 'productivity', 'high'),
  ('Microsoft Office', 'keyword', 'microsoft office', 'productivity', 'high'),
  ('Mozilla Firefox', 'keyword', 'firefox', 'browser', 'high'),
  ('Google Chrome', 'keyword', 'google chrome', 'browser', 'high'),
  ('Microsoft Edge', 'keyword', 'microsoft edge', 'browser', 'high'),
  ('Brave Browser', 'keyword', 'brave browser', 'browser', 'medium'),
  ('LibreOffice', 'keyword', 'libreoffice', 'productivity', 'medium'),
  ('Java / OpenJDK', 'keyword', 'openjdk', 'language', 'high'),
  ('React (JS lib)', 'keyword', 'react', 'framework', 'medium'),
  ('Go (Golang)', 'keyword', 'golang', 'language', 'medium'),
  ('Microsoft Teams', 'keyword', 'microsoft teams', 'collaboration', 'high'),
  ('Google Meet', 'keyword', 'google meet', 'collaboration', 'medium'),
  ('Zoom', 'keyword', 'zoom', 'collaboration', 'high'),
  ('Slack', 'keyword', 'slack', 'collaboration', 'medium'),
  ('Node.js', 'keyword', 'nodejs', 'language', 'high'),
  ('Python', 'keyword', 'python', 'language', 'medium'),
  ('PHP', 'keyword', 'php', 'language', 'high'),
  ('PostgreSQL', 'keyword', 'postgresql', 'database', 'high'),
  ('MySQL / MariaDB', 'keyword', 'mysql', 'database', 'high'),
  ('Redis', 'keyword', 'redis', 'database', 'high'),
  ('Elasticsearch', 'keyword', 'elasticsearch', 'database', 'medium'),
  ('Kubernetes', 'keyword', 'kubernetes', 'container', 'high'),
  ('Docker', 'keyword', 'docker', 'container', 'high'),
  ('Ubuntu', 'keyword', 'ubuntu', 'os', 'medium'),
  ('Red Hat Enterprise Linux', 'keyword', 'red hat enterprise linux', 'os', 'high'),
  ('Windows Server', 'keyword', 'windows server', 'os', 'high'),
  ('VMware vSphere / ESXi', 'keyword', 'vmware esxi', 'virtualization', 'critical'),
  ('Microsoft Hyper-V', 'keyword', 'hyper-v', 'virtualization', 'high'),
  ('Nginx', 'keyword', 'nginx', 'webserver', 'high'),
  ('Apache HTTP Server', 'keyword', 'apache http server', 'webserver', 'high'),
  ('GitLab', 'keyword', 'gitlab', 'devops', 'high'),
  ('Jenkins', 'keyword', 'jenkins', 'devops', 'high')
ON CONFLICT DO NOTHING;

-- Agendar cron horário para sync NVD
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-nvd-hourly') THEN
      PERFORM cron.unschedule('sync-nvd-hourly');
    END IF;
    PERFORM cron.schedule(
      'sync-nvd-hourly',
      '15 * * * *',
      $cron$
      SELECT net.http_post(
        url := 'https://hulbzdhqiuczvqbnoivv.supabase.co/functions/v1/sync-nvd-vulnerabilities',
        headers := '{"Content-Type":"application/json"}'::jsonb,
        body := '{"force":false,"days_back":7}'::jsonb
      );
      $cron$
    );
  END IF;
END $$;