import AWS from 'aws-sdk'
import { useMemo } from 'react'

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'us-east-1',
})

const s3 = new AWS.S3()

function formatDate(dateObject: Date) {
  const year = dateObject.getUTCFullYear()
  const month = dateObject.getUTCMonth() + 1
  const date = dateObject.getUTCDate()

  return `${year}-${month}-${date}`
}

function getBucketObject({
  bucket,
  prefix,
}: {
  bucket: string
  prefix?: string
}) {
  return new Promise<any>((resolve, reject) => {
    s3.listObjectsV2(
      {
        Bucket: bucket,
        ...(prefix ? { Prefix: prefix } : {}),
      },
      function (error, data) {
        if (error) {
          reject(error)
        } else {
          resolve(data)
        }
      }
    )
  })
}

async function TaskEntry({ date }: { date: Date }) {
  const bucketList = [
    'auto-news-podcast-tasks',
    'auto-news-podcast-news-api-data',
    'auto-news-podcast-news-content',
    'auto-news-podcast-post-processed-news-content',
    'auto-news-podcast-raw-podcast-transcript',
    'auto-news-podcast-post-processed-podcast-transcript',
    'auto-news-podcast-transcript-vocals',
    'auto-news-podcast-final-audios',
  ]

  const formattedDate = formatDate(date)
  const prefix = formattedDate

  const dataList = await Promise.all(
    bucketList.map((bucket) =>
      getBucketObject({
        bucket,
        prefix,
      })
    )
  )

  // https://auto-news-podcast-final-audios.s3.amazonaws.com/2024-1-27-1706317219304.mp3

  return (
    <tr>
      <td style={{ whiteSpace: 'nowrap' }}>{formattedDate}</td>
      {dataList.map((data, index) => {
        let content = null

        if (
          data?.Name &&
          Array.isArray(data?.Contents) &&
          data.Contents.length > 0
        ) {
          if (data.Name === 'auto-news-podcast-news-content') {
            content = data.Contents.map((value: any) => (
              <div key={value?.Key}>{value?.Key}</div>
            ))
          } else if (
            data.Name === 'auto-news-podcast-post-processed-podcast-transcript'
          ) {
            content = (
              <a
                href={`https://auto-news-podcast-post-processed-podcast-transcript.s3.amazonaws.com/${data?.Contents?.[0]?.Key}`}
                download
              >
                {data?.Contents?.[0]?.Key}
              </a>
            )
          } else if (data.Name === 'auto-news-podcast-final-audios') {
            content = (
              <a
                href={`https://auto-news-podcast-final-audios.s3.amazonaws.com/${data?.Contents?.[0]?.Key}`}
                download
              >
                {data?.Contents?.[0]?.Key}
              </a>
            )
          } else {
            content = data?.Contents?.[0]?.Key
          }
        }

        return (
          <td
            key={index}
            style={{
              background: content ? 'lightgreen' : 'red',
              whiteSpace: 'nowrap',
            }}
          >
            {content}
          </td>
        )
      })}
    </tr>
  )
}

function TaskEntries() {
  const now = Date.now()
  const numberOfDates = 3

  const dateList = useMemo(() => {
    return new Array(numberOfDates).fill(undefined).map((value, index) => {
      return new Date(now - index * 86400 * 1000)
    })
  }, [now])

  return (
    <tbody>
      {dateList.map((date) => (
        <TaskEntry key={date.valueOf()} date={date} />
      ))}
    </tbody>
  )
}

export default function Home() {
  return (
    <table border={1} style={{ overflowX: 'scroll' }}>
      <thead>
        <tr>
          <th>Date</th>
          <th>Tasks</th>
          <th>News API Data</th>
          <th>News Contents</th>
          <th>Post-processed News Contents</th>
          <th>Raw Podcast Transcripts</th>
          <th>Post-processed Podcast Transcripts</th>
          <th>Transcript Vocals</th>
          <th>Final Audios</th>
        </tr>
      </thead>

      <TaskEntries />
    </table>
  )
}
