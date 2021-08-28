import React, { ReactElement, useState, useEffect, useRef } from 'react'
import Permission from '../../organisms/Permission'
import { Field, Formik, FormikState } from 'formik'
import { usePublish } from '../../../hooks/usePublish'
import styles from './index.module.css'
import FormPublish from './FormPublish'
import FormAlgoPublish from './FormAlgoPublish'
import Web3Feedback from '../../molecules/Web3Feedback'
import Tabs from '../../atoms/Tabs'
import { initialValues, validationSchema } from '../../../models/FormPublish'
import {
  initialValues as initialValuesAlgorithm,
  validationSchema as validationSchemaAlgorithm
} from '../../../models/FormAlgoPublish'
import {
  transformPublishFormToMetadata,
  transformPublishAlgorithmFormToMetadata,
  mapTimeoutStringToSeconds,
  validateDockerImage
} from '../../../utils/metadata'
import {
  MetadataPreview,
  MetadataAlgorithmPreview
} from '../../molecules/MetadataPreview'
import {
  MetadataPublishFormDataset,
  MetadataPublishFormAlgorithm
} from '../../../@types/MetaData'
import { useUserPreferences } from '../../../providers/UserPreferences'
import { DDO, Logger, Metadata, MetadataMain } from '@oceanprotocol/lib'
import { Persist } from '../../atoms/FormikPersist'
import Debug from './Debug'
import Alert from '../../atoms/Alert'
import MetadataFeedback from '../../molecules/MetadataFeedback'
import { useAccountPurgatory } from '../../../hooks/useAccountPurgatory'
import { useWeb3 } from '../../../providers/Web3'
import Loader from '../../atoms/Loader'
import feedbackStyles from '../../molecules/MetadataFeedback.module.css'

const formNameDatasets = 'ocean-publish-form-datasets'
const formNameAlgorithms = 'ocean-publish-form-algorithms'

function TabContent({
  publishType,
  values,
  tutorial
}: {
  publishType: MetadataMain['type']
  values: Partial<MetadataPublishFormAlgorithm | MetadataPublishFormDataset>
  tutorial?: boolean
}) {
  return (
    <article className={styles.grid}>
      {publishType === 'dataset' ? (
        <FormPublish tutorial={tutorial} />
      ) : (
        <FormAlgoPublish />
      )}

      <aside>
        <div className={styles.sticky}>
          {publishType === 'dataset' ? (
            <MetadataPreview values={values} />
          ) : (
            <MetadataAlgorithmPreview values={values} />
          )}
          <Web3Feedback />
        </div>
      </aside>
    </article>
  )
}

export default function PublishPage({
  content,
  datasetOnly,
  tutorial,
  ddo,
  setTutorialDdo,
  loading
}: {
  content: { warning: string }
  datasetOnly?: boolean
  tutorial?: boolean
  ddo?: DDO
  setTutorialDdo?: (value: DDO) => void
  loading?: boolean
}): ReactElement {
  const { debug } = useUserPreferences()
  const { accountId } = useWeb3()
  const { isInPurgatory, purgatoryData } = useAccountPurgatory(accountId)
  const { publish, publishError, isLoading, publishStepText } = usePublish()
  const [success, setSuccess] = useState<string>()
  const [error, setError] = useState<string>()
  const [title, setTitle] = useState<string>()
  const [did, setDid] = useState<string>()
  const [algoInitialValues, setAlgoInitialValues] = useState<
    Partial<MetadataPublishFormAlgorithm>
  >(
    (localStorage.getItem('ocean-publish-form-algorithms') &&
      (JSON.parse(localStorage.getItem('ocean-publish-form-algorithms'))
        .initialValues as MetadataPublishFormAlgorithm)) ||
      initialValuesAlgorithm
  )
  const [datasetInitialValues, setdatasetInitialValues] = useState<
    Partial<MetadataPublishFormDataset>
  >(
    (localStorage.getItem('ocean-publish-form-datasets') &&
      (JSON.parse(localStorage.getItem('ocean-publish-form-datasets'))
        .initialValues as MetadataPublishFormDataset)) ||
      initialValues
  )
  const [publishType, setPublishType] =
    useState<MetadataMain['type']>('dataset')
  const hasFeedback = isLoading || error || success

  const emptyAlgoDT = Object.values(algoInitialValues.dataTokenOptions).every(
    (value) => value === ''
  )
  const emptyDatasetDT = Object.values(
    datasetInitialValues.dataTokenOptions
  ).every((value) => value === '')

  if (emptyAlgoDT) {
    algoInitialValues.dataTokenOptions = datasetInitialValues.dataTokenOptions
  } else {
    if (emptyDatasetDT)
      datasetInitialValues.dataTokenOptions = algoInitialValues.dataTokenOptions
  }

  useEffect(() => {
    publishType === 'dataset'
      ? setTitle('Publishing Data Set')
      : setTitle('Publishing Algorithm')
  }, [publishType])

  const publishRef = useRef(null)
  const executeScroll = () =>
    publishRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' })
  useEffect(() => {
    if (tutorial && isLoading) {
      executeScroll()
    }
  }, [isLoading])

  async function handleSubmit(
    values: Partial<MetadataPublishFormDataset>,
    resetForm: (
      nextState?: Partial<FormikState<Partial<MetadataPublishFormDataset>>>
    ) => void
  ): Promise<void> {
    const metadata = transformPublishFormToMetadata(values)
    const timeout = mapTimeoutStringToSeconds(values.timeout)

    const serviceType = values.access === 'Download' ? 'access' : 'compute'

    try {
      Logger.log(
        'Publish with ',
        metadata,
        serviceType,
        values.dataTokenOptions,
        values.providerUri
      )

      const ddo = await publish(
        metadata as unknown as Metadata,
        serviceType,
        values.dataTokenOptions,
        timeout,
        values.providerUri
      )

      // Publish failed
      if (!ddo || publishError) {
        setError(publishError || 'Publishing DDO failed.')
        Logger.error(publishError || 'Publishing DDO failed.')
        return
      }
      // Publish succeeded
      if (tutorial) setTutorialDdo(ddo)
      setDid(ddo.id)
      setSuccess(
        '🎉 Successfully published. 🎉 Now create a price on your data set.'
      )
      resetForm({
        values: initialValues as MetadataPublishFormDataset,
        status: 'empty'
      })
      // move user's focus to top of screen
      if (!tutorial) {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
      }
    } catch (error) {
      setError(error.message)
      Logger.error(error.message)
    }
  }

  async function handleAlgorithmSubmit(
    values: Partial<MetadataPublishFormAlgorithm>,
    resetForm: (
      nextState?: Partial<FormikState<Partial<MetadataPublishFormAlgorithm>>>
    ) => void
  ): Promise<void> {
    const metadata = transformPublishAlgorithmFormToMetadata(values)
    const timeout = mapTimeoutStringToSeconds(values.timeout)
    const validDockerImage =
      values.dockerImage === 'custom image'
        ? await validateDockerImage(values.image, values.containerTag)
        : true
    try {
      if (validDockerImage) {
        Logger.log(
          'Publish algorithm with ',
          metadata,
          values.dataTokenOptions,
          values.providerUri
        )

        const ddo = await publish(
          metadata as unknown as Metadata,
          values.algorithmPrivacy === true ? 'compute' : 'access',
          values.dataTokenOptions,
          timeout,
          values.providerUri
        )

        // Publish failed
        if (!ddo || publishError) {
          setError(publishError || 'Publishing DDO failed.')
          Logger.error(publishError || 'Publishing DDO failed.')
          return
        }

        // Publish succeeded
        setDid(ddo.id)
        setSuccess(
          '🎉 Successfully published. 🎉 Now create a price for your algorithm.'
        )
        resetForm({
          values: initialValuesAlgorithm as MetadataPublishFormAlgorithm,
          status: 'empty'
        })
        // move user's focus to top of screen
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
      } else {
        document.getElementById('image').scrollIntoView({ behavior: 'smooth' })
      }
    } catch (error) {
      setError(error.message)
      Logger.error(error.message)
    }
  }
  return isInPurgatory && purgatoryData ? null : (
    <Permission eventType="publish">
      <Formik
        initialValues={
          publishType === 'dataset' ? datasetInitialValues : algoInitialValues
        }
        initialStatus="empty"
        validationSchema={
          publishType === 'dataset'
            ? validationSchema
            : validationSchemaAlgorithm
        }
        onSubmit={async (values, { resetForm }) => {
          // kick off publishing
          publishType === 'dataset'
            ? await handleSubmit(values, resetForm)
            : await handleAlgorithmSubmit(values, resetForm)
        }}
        enableReinitialize
      >
        {({ values }) => {
          const tabs = [
            {
              title: 'Data Set',
              content: (
                <TabContent
                  values={values}
                  publishType={publishType}
                  tutorial={tutorial}
                />
              )
            },
            {
              title: 'Algorithm',
              content: <TabContent values={values} publishType={publishType} />
            }
          ]

          return (
            <div ref={publishRef}>
              <Persist
                name={
                  publishType === 'dataset'
                    ? formNameDatasets
                    : formNameAlgorithms
                }
                ignoreFields={['isSubmitting']}
              />

              {hasFeedback && loading ? (
                <div className={feedbackStyles.feedback}>
                  <div className={feedbackStyles.box}>
                    <Loader />
                  </div>
                </div>
              ) : hasFeedback ? (
                <>
                  <MetadataFeedback
                    title={title}
                    error={error}
                    success={success}
                    loading={publishStepText}
                    setError={setError}
                    successAction={{
                      name: `Go to ${
                        publishType === 'dataset' ? 'data set' : 'algorithm'
                      } →`,
                      to: `/asset/${did}`
                    }}
                    tutorial={tutorial}
                    ddo={ddo}
                  />
                </>
              ) : (
                <>
                  <Tabs
                    className={styles.tabs}
                    items={
                      !datasetOnly
                        ? tabs
                        : tabs.filter((e) => e.title === 'Data Set')
                    }
                    handleTabChange={(title) => {
                      setPublishType(
                        title.toLowerCase().replace(' ', '') as any
                      )
                      title === 'Algorithm'
                        ? setdatasetInitialValues(values)
                        : setAlgoInitialValues(values)
                    }}
                  />
                </>
              )}

              {debug === true && <Debug values={values} />}
            </div>
          )
        }}
      </Formik>
    </Permission>
  )
}
