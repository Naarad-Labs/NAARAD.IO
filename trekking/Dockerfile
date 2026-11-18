FROM python:3.13-slim

WORKDIR /srv/naarad/trekking
COPY trekking/requirements.txt trekking/requirements-site.txt ./
RUN pip install --no-cache-dir -r requirements-site.txt \
    && useradd --system --user-group --uid 10001 trekking \
    && install -d -o trekking -g trekking /var/lib/trekking
COPY index.html 404.html sw.js manifest.json robots.txt sitemap.xml googlecc72b0f2c9685bc7.html /srv/naarad/
COPY Images/ /srv/naarad/Images/
COPY about/ /srv/naarad/about/
COPY app/ /srv/naarad/app/
COPY collections/ /srv/naarad/collections/
COPY content/ /srv/naarad/content/
COPY creators/ /srv/naarad/creators/
COPY discover/ /srv/naarad/discover/
COPY explore/ /srv/naarad/explore/
COPY internal/ /srv/naarad/internal/
COPY journey/ /srv/naarad/journey/
COPY routes/ /srv/naarad/routes/
COPY stories/ /srv/naarad/stories/
COPY trekking/*.py trekking/schema.sql trekking/demo_routes.json ./
COPY trekking/static/ ./static/
USER trekking
EXPOSE 8000
CMD ["gunicorn", "--no-control-socket", "--bind", "0.0.0.0:8000", "--threads", "4", "naarad_site:create_site()"]
