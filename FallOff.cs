using System.Collections;
using UnityEngine;
using UnityEngine.SceneManagement;

public class FallOff : MonoBehaviour
{
    [SerializeField] AudioSource fallSound;
    [SerializeField] GameObject levelBGM;
    [SerializeField] GameObject fadeOut;

    void OnTriggerEnter(Collider other)
    {
        levelBGM.SetActive(false);
        fallSound.Play();
        fadeOut.SetActive(true);
        StartCoroutine(Respawn());
    }

    IEnumerator Respawn()
    {
        yield return new WaitForSeconds(2);
        SceneManager.LoadScene(3);
    }
}
