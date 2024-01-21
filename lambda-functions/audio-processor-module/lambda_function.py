from pydub import AudioSegment
from io import BytesIO
import boto3
import json
import re

# AudioSegment.coverter = '/opt/ffmpeg'
# AudioSegment.ffmpeg = '/opt/ffmpeg'
# AudioSegment.ffprobe = '/opt/ffprobe'

s3_client = boto3.client('s3')

def read_data_from_s3_bucket(bucket, key, decode = True):
  file_content = s3_client.get_object(Bucket=bucket, Key=key)['Body'].read()

  if decode:
    return file_content.decode('utf-8')
  else:
    return file_content

def parse_s3_info_from_event(event):
  # Handle POST
  request_body = event.get('body')

  if request_body:
    parsed_request_body = json.loads(request_body)
    bucket = parsed_request_body.get('bucket')
    key = parsed_request_body.get('key')

    return { 'bucket': bucket, 'key': key }

  # S3 PUT
  bucket = event['Records'][0]['s3']['bucket']['name']
  key = event['Records'][0]['s3']['object']['key']

  return { 'bucket': bucket, 'key': key }

def lambda_handler(event, context):
  parsed_s3_info = parse_s3_info_from_event(event)

  task_bucket = parsed_s3_info.get('bucket')
  task_key = parsed_s3_info.get('key')
  task_content = read_data_from_s3_bucket(task_bucket, task_key)

  # background_music_template = task_content.get('musicTemplate')

  vocal_bucket = task_bucket
  vocal_key = re.sub(r'\.json$', '.wav', task_key)
  vocal_content = read_data_from_s3_bucket(vocal_bucket, vocal_key, False)
  audio_vocal = AudioSegment.from_file(BytesIO(vocal_content), format='wav')

  background_music_bucket = 'auto-news-podcast-background-music'
  background_music_key = 'good-night.mp3'
  background_music_content = read_data_from_s3_bucket(background_music_bucket, background_music_key, False)
  audio_background_music = AudioSegment.from_file(BytesIO(background_music_content), format='mp3')

  # Process audios
  opening_offset = 0 # good-night: 0, city-pop: 4000

  audio_vocal = (
    AudioSegment.silent(duration=(12000 + opening_offset)) +
    audio_vocal +
    AudioSegment.silent(duration=4000) + # ending 1 - 大聲四秒
    AudioSegment.silent(duration=4000) + # ending 2 - 播放四秒
    AudioSegment.silent(duration=4000) # ending 3 - 四秒後靜音
  )

  # 確保背景音樂的長度與主要人聲相同
  while len(audio_background_music) < len(audio_vocal):
    audio_background_music += audio_background_music
  audio_background_music = audio_background_music[:len(audio_vocal)]

  # 開頭: 在第 6 秒開始漸弱音量, 到第 10 秒時達到原始音量的 20%
  begin_fade = 6000 + opening_offset
  end_fade = 10000 + opening_offset
  final_volume = -15
  audio_background_music = audio_background_music.fade(to_gain=final_volume, start=begin_fade, end=end_fade)

  # 結尾 1 音量調整
  begin_fade = len(audio_background_music) - (4000 + 4000 + 4000)
  end_fade = len(audio_background_music) - (4000 + 4000)
  final_volume = 15
  audio_background_music = audio_background_music.fade(to_gain=final_volume, start=begin_fade, end=end_fade)

  # 結尾 2 音量調整
  begin_fade = len(audio_background_music) - 4000
  end_fade = len(audio_background_music)
  final_volume = -80
  audio_background_music = audio_background_music.fade(to_gain=final_volume, start=begin_fade, end=end_fade)

  final_track = audio_vocal.overlay(audio_background_music)
  mp3_buffer = BytesIO()
  final_track.export(mp3_buffer, format='mp3')

  mp3_buffer.seek(0)

  output_bucket = 'auto-news-podcast-final-audios'
  output_key = re.sub(r'\.json$', '.mp3', task_key)
  s3_client.put_object(Bucket=output_bucket, Key=output_key, Body=mp3_buffer)

  mp3_buffer.close()

  return {
    'statusCode': 200,
    'body': 'Audio processed successfully. Write key {} to bucket {}.'.format(output_key, output_bucket)
  }
